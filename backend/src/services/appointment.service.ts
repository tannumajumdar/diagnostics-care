import { Appointment } from '../models/appointment.model';
import { Patient } from '../models/patient.model';
import { getNextAppointmentId } from '../models/counter.model';
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

    const appointment = await Appointment.create({
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
    const filter: any = {};

    if (collectionType) filter.collectionType = collectionType;
    if (status) filter.status = status;
    if (phlebotomistId) filter['phlebotomist.userId'] = phlebotomistId;

    if (search) {
      filter.$or = [
        { appointmentId: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
      ];

      // The UHID lives on the patient, not on the appointment, so searching it
      // means finding the patient first. Without this the desk can read a UHID
      // off a card but cannot use it to pull up the booking it belongs to.
      const matchingPatients = await Patient.find({
        uhid: { $regex: search, $options: 'i' },
      }).select('_id');

      if (matchingPatients.length > 0) {
        filter.$or.push({ patient: { $in: matchingPatients.map((p) => p._id) } });
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate('patient')
        .populate('doctor')
        .populate('tests')
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Appointment.countDocuments(filter),
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
    const apt = await Appointment.findById(id)
      .populate('patient')
      .populate('doctor')
      .populate('tests');

    if (!apt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Appointment not found');
    }
    return apt;
  }

  static async assignPhlebotomist(
    id: string,
    phlebotomist: { userId: string; name: string; mobile?: string }
  ) {
    const apt = await Appointment.findById(id);
    if (!apt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Appointment not found');
    }

    apt.phlebotomist = phlebotomist;
    apt.status = 'Assigned';
    await apt.save();
    return apt;
  }

  static async updateStatus(id: string, status: any, notes?: string) {
    const apt = await Appointment.findById(id);
    if (!apt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Appointment not found');
    }

    apt.status = status;
    if (notes) apt.notes = notes;
    await apt.save();

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
