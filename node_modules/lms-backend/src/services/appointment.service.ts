import { prisma } from '../db/prisma';
import { repo, regexAny, regexWhere, mongoSort } from '../db/repo';
import { getNextAppointmentId } from '../db/counters';

/** `.populate('patient').populate('doctor').populate('tests')` - whole documents, a test's parameters included. */
const APPOINTMENT_REFS = {
  patient: true,
  doctor: true,
  tests: { include: { test: { include: { parameters: true } } } },
};
import { NotificationService } from './notification.service';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export interface CreateAppointmentPayload {
  patientId?: string;
  patientName: string;
  mobile: string;
  doctorId?: string;
  testIds?: string[];
  date: string;
  time: string;
  collectionType: 'Lab Visit' | 'Home Collection';
  address?: string;
  notes?: string;
}

export class AppointmentService {
  static async createAppointment(payload: CreateAppointmentPayload) {
    const {
      patientId,
      patientName,
      mobile,
      doctorId,
      testIds = [],
      date,
      time,
      collectionType,
      address = '',
      notes = '',
    } = payload;

    const appointmentId = await getNextAppointmentId();

    const appointment = await repo.create('appointment', {
      appointmentId,
      patient: patientId || undefined,
      patientName,
      mobile,
      doctor: doctorId || undefined,
      tests: testIds,
      date: new Date(date),
      time,
      collectionType,
      address,
      status: 'Pending',
      notes,
    });

    // Trigger confirmation notification
    NotificationService.sendNotification({
      recipient: mobile,
      mobile,
      patientName,
      event: 'APPOINTMENT_CONFIRMED',
      data: { appointmentId, date, time, collectionType },
    });

    return appointment;
  }

  static async getAll(query: {
    search?: string;
    collectionType?: string;
    status?: string;
    phlebotomistId?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, collectionType, status, phlebotomistId, page = 1, limit = 10 } = query;
    const filter: any = { AND: [] };

    if (collectionType) filter.collectionType = collectionType;
    if (status) filter.status = status;
    if (phlebotomistId) filter.phlebotomistUserId = String(phlebotomistId);

    if (search) {
      const or = await regexAny('appointment', ['appointmentId', 'patientName', 'mobile'], String(search));

      // The UHID lives on the patient, not on the appointment, so searching it
      // means finding the patient first. Without this the desk can read a UHID
      // off a card but cannot use it to pull up the booking it belongs to.
      const matchingPatients = await prisma.patient.findMany({
        where: await regexWhere('patient', 'uhid', String(search)),
        select: { id: true },
      });

      if (matchingPatients.length > 0) {
        or.OR.push({ patientId: { in: matchingPatients.map((p) => p.id) } });
      }
      filter.AND.push(or);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [appointments, total] = await Promise.all([
      repo.find('appointment', {
        where: filter,
        include: APPOINTMENT_REFS,
        orderBy: mongoSort('appointment', { date: 1, time: 1 }),
        skip,
        take: Number(limit),
      }),
      repo.count('appointment', filter),
    ]);

    return {
      appointments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  static async getById(id: string) {
    const apt = await repo.findById('appointment', id, { include: APPOINTMENT_REFS });

    if (!apt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Appointment not found');
    }
    return apt;
  }

  static async assignPhlebotomist(
    id: string,
    phlebotomist: { userId: string; name: string; mobile?: string }
  ) {
    const apt = await repo.findById('appointment', id);
    if (!apt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Appointment not found');
    }

    apt.phlebotomist = phlebotomist;
    apt.status = 'Assigned';
    return repo.save('appointment', apt);
  }

  static async updateStatus(id: string, status: any, notes?: string) {
    const found = await repo.findById('appointment', id);
    if (!found) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Appointment not found');
    }

    found.status = status;
    if (notes) found.notes = notes;
    const apt = await repo.save('appointment', found);

    if (status === 'Collected') {
      NotificationService.sendNotification({
        recipient: apt.mobile,
        mobile: apt.mobile,
        patientName: apt.patientName,
        event: 'SAMPLE_COLLECTED',
        data: { appointmentId: apt.appointmentId },
      });
    }

    return apt;
  }
}
