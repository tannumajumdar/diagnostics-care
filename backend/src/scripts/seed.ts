import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Department } from '../models/department.model';
import { Doctor } from '../models/doctor.model';
import { LabTest } from '../models/test.model';
import { parametersForTest } from '../constants/test-parameters';
import { Organization } from '../models/organization.model';
import { Patient } from '../models/patient.model';
import { Invoice } from '../models/invoice.model';
import { Payment } from '../models/payment.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';
import { Appointment } from '../models/appointment.model';
import { Refund } from '../models/refund.model';
import { Payout } from '../models/expense.model';
import { Counter } from '../models/counter.model';

export async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    console.log('🌱 Seeding database collections...');

    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Doctor.deleteMany({}),
      LabTest.deleteMany({}),
      Organization.deleteMany({}),
      Patient.deleteMany({}),
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      Sample.deleteMany({}),
      Result.deleteMany({}),
      Appointment.deleteMany({}),
      Refund.deleteMany({}),
      Payout.deleteMany({}),
      // Sequence numbers are reset with the data they number. Leaving them
      // behind meant the demo records below, which carry fixed ids, collided
      // with the first real invoice or payout the counter handed out.
      Counter.deleteMany({}),
    ]);

    const users: any[] = await User.create([
      {
        name: 'Centre Admin',
        email: 'admin@lms.com',
        password: 'Admin@123456',
        role: 'Admin',
        mobile: '9876543211',
        status: 'Active',
      },
      {
        name: 'Dr. Sarah Jenkins',
        email: 'pathologist@lms.com',
        password: 'User@123456',
        role: 'Pathologist',
        mobile: '9876543212',
        status: 'Active',
      },
      {
        name: 'Alex Rivera',
        email: 'technician@lms.com',
        password: 'User@123456',
        role: 'Lab Technician',
        mobile: '9876543213',
        status: 'Active',
      },
      {
        name: 'Emily Davis',
        email: 'receptionist@lms.com',
        password: 'User@123456',
        role: 'Receptionist',
        mobile: '9876543214',
        status: 'Active',
      },
      // The desk runs in shifts - each shift's receptionist takes their own cash.
      {
        name: 'Neha Sharma',
        email: 'neha@lms.com',
        password: 'User@123456',
        role: 'Receptionist',
        mobile: '9876543215',
        status: 'Active',
      },
      {
        name: 'Rohit Verma',
        email: 'rohit@lms.com',
        password: 'User@123456',
        role: 'Receptionist',
        mobile: '9876543216',
        status: 'Active',
      },
    ]);

    const adminUser = users[0];
    const receptionUser = users[3];
    const techUser = users[2];

    const depts: any[] = await Department.create([
      { departmentName: 'Pathology', departmentCode: 'PATH', description: 'General Pathology', status: 'Active' },
      { departmentName: 'Biochemistry', departmentCode: 'BIO', description: 'Clinical Biochemistry', status: 'Active' },
      { departmentName: 'Hematology', departmentCode: 'HEMA', description: 'Blood Cell Studies', status: 'Active' },
      { departmentName: 'Microbiology', departmentCode: 'MICRO', description: 'Bacterial Studies', status: 'Active' },
    ]);

    // The doctors who actually send work to a small diagnostic centre. These
    // are the specialities behind a CBC or a fasting sugar - a physician, a
    // diabetologist, a gynaecologist, a paediatrician - so the front desk has
    // a usable panel to pick from on day one. Any other doctor's name can
    // still be typed straight onto the bill.
    const doctorPanel: any[] = await Doctor.create([
      {
        doctorName: 'Dr. Anjali Mehra',
        department: depts[0]._id,
        degree: 'MBBS, MD (Medicine)',
        specialty: 'General Physician',
        mobile: '9812345678',
        email: 'dr.mehra@clinic.example',
        hospital: 'Mehra Clinic',
        paymentTerm: 'Monthly',
        discountType: 'Percentage',
        discountPercentage: 10,
        commission: 15,
        status: 'Active',
      },
      {
        doctorName: 'Dr. Rakesh Sharma',
        department: depts[1]._id,
        degree: 'MBBS, MD, DM (Endocrinology)',
        specialty: 'Diabetologist',
        mobile: '9812345679',
        email: 'dr.sharma@clinic.example',
        hospital: 'Sharma Diabetes Care',
        paymentTerm: 'Monthly',
        discountType: 'Percentage',
        discountPercentage: 10,
        commission: 12,
        status: 'Active',
      },
      {
        doctorName: 'Dr. Priya Nair',
        department: depts[2]._id,
        degree: 'MBBS, MS (Obs & Gynae)',
        specialty: 'Gynaecologist',
        mobile: '9812345680',
        email: 'dr.nair@clinic.example',
        hospital: 'Nair Maternity Centre',
        paymentTerm: 'Monthly',
        discountType: 'Percentage',
        discountPercentage: 5,
        commission: 12,
        status: 'Active',
      },
      {
        doctorName: 'Dr. Imran Qureshi',
        department: depts[2]._id,
        degree: 'MBBS, MD (Paediatrics)',
        specialty: 'Paediatrician',
        mobile: '9812345681',
        email: 'dr.qureshi@clinic.example',
        hospital: 'Little Steps Child Clinic',
        paymentTerm: 'Monthly',
        discountType: 'Percentage',
        discountPercentage: 5,
        commission: 10,
        status: 'Active',
      },
      {
        doctorName: 'Dr. Sunil Deshmukh',
        department: depts[0]._id,
        degree: 'MBBS',
        specialty: 'General Practitioner',
        mobile: '9812345682',
        email: 'dr.deshmukh@clinic.example',
        hospital: 'Deshmukh Family Clinic',
        paymentTerm: 'Monthly',
        discountType: 'Percentage',
        discountPercentage: 5,
        commission: 10,
        status: 'Active',
      },
    ]);

    const doctor: any = doctorPanel[0];

    const tests: any[] = await LabTest.create([
      {
        testName: 'Complete Blood Count (CBC)',
        testCode: 'CBC001',
        department: depts[2]._id,
        testType: 'Routine',
        sampleType: 'Whole Blood',
        sampleContainer: 'EDTA Purple Top Vial',
        rate: 500,
        patientRate: 500,
        corporateRate: 400,
        doctorRate: 350,
        emergencyRate: 750,
        discountAllowed: true,
        fastingRequired: false,
        turnaroundTime: '6 Hours',
        status: 'Active',
        parameters: [
          {
            parameterName: 'Hemoglobin (Hb)',
            shortName: 'Hb',
            unit: 'g/dL',
            maleReferenceRange: '13.5 - 17.5',
            femaleReferenceRange: '12.0 - 15.5',
            criticalLow: '7.0',
            criticalHigh: '20.0',
            method: 'Spectrophotometry',
            resultType: 'Numeric',
            displayOrder: 1,
          },
          {
            parameterName: 'Total Leukocyte Count (TLC)',
            shortName: 'TLC',
            unit: 'x10^3/uL',
            maleReferenceRange: '4.5 - 11.0',
            femaleReferenceRange: '4.5 - 11.0',
            criticalLow: '2.0',
            criticalHigh: '30.0',
            method: 'Automated Cell Counter',
            resultType: 'Numeric',
            displayOrder: 2,
          },
        ],
      },
      {
        testName: 'Fasting Blood Sugar (FBS)',
        testCode: 'FBS001',
        department: depts[1]._id,
        testType: 'Routine',
        sampleType: 'Serum / Fluoride Plasma',
        sampleContainer: 'Grey Top Vial',
        rate: 300,
        patientRate: 300,
        corporateRate: 250,
        doctorRate: 200,
        emergencyRate: 450,
        discountAllowed: true,
        fastingRequired: true,
        turnaroundTime: '4 Hours',
        status: 'Active',
        parameters: [
          {
            parameterName: 'Fasting Blood Glucose',
            shortName: 'FBG',
            unit: 'mg/dL',
            maleReferenceRange: '70 - 99',
            femaleReferenceRange: '70 - 99',
            criticalLow: '40',
            criticalHigh: '400',
            method: 'GOD-POD Method',
            resultType: 'Numeric',
            displayOrder: 1,
          },
        ],
      },
    ]);

    /**
     * The rest of the everyday menu. Rates are indicative; the parameter sheets
     * come from the catalogue so every one of these is runnable end to end -
     * bill it, collect it, enter the values, print the report.
     */
    const routineMenu = [
      { testName: 'Lipid Profile', testCode: 'LIP001', dept: 1, sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial', rate: 900, fasting: true, tat: '8 Hours' },
      { testName: 'Liver Function Test (LFT)', testCode: 'LFT001', dept: 1, sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial', rate: 950, fasting: false, tat: '8 Hours' },
      { testName: 'Kidney Function Test (KFT)', testCode: 'KFT001', dept: 1, sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial', rate: 900, fasting: false, tat: '8 Hours' },
      { testName: 'Thyroid Profile (T3 T4 TSH)', testCode: 'TFT001', dept: 1, sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial', rate: 700, fasting: false, tat: '12 Hours' },
      { testName: 'HbA1c (Glycated Hemoglobin)', testCode: 'HBA001', dept: 1, sampleType: 'Whole Blood', sampleContainer: 'EDTA Purple Top Vial', rate: 650, fasting: false, tat: '12 Hours' },
      { testName: 'Urine Routine Examination', testCode: 'URE001', dept: 0, sampleType: 'Urine', sampleContainer: 'Sterile Urine Container', rate: 250, fasting: false, tat: '4 Hours' },
      { testName: 'Erythrocyte Sedimentation Rate (ESR)', testCode: 'ESR001', dept: 2, sampleType: 'Whole Blood', sampleContainer: 'EDTA Purple Top Vial', rate: 200, fasting: false, tat: '4 Hours' },
      { testName: 'Blood Group & Rh Typing', testCode: 'BGR001', dept: 2, sampleType: 'Whole Blood', sampleContainer: 'EDTA Purple Top Vial', rate: 200, fasting: false, tat: '2 Hours' },
      { testName: 'Dengue NS1, IgM & IgG', testCode: 'DEN001', dept: 3, sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial', rate: 1200, fasting: false, tat: '12 Hours' },
      { testName: 'Widal Test (Typhoid)', testCode: 'WID001', dept: 3, sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial', rate: 400, fasting: false, tat: '12 Hours' },
    ];

    await LabTest.create(
      routineMenu.map((t) => ({
        testName: t.testName,
        testCode: t.testCode,
        department: depts[t.dept]._id,
        testType: 'Routine',
        sampleType: t.sampleType,
        sampleContainer: t.sampleContainer,
        rate: t.rate,
        patientRate: t.rate,
        corporateRate: Math.round(t.rate * 0.8),
        doctorRate: Math.round(t.rate * 0.7),
        emergencyRate: Math.round(t.rate * 1.5),
        discountAllowed: true,
        fastingRequired: t.fasting,
        turnaroundTime: t.tat,
        status: 'Active',
        parameters: parametersForTest(t.testName, t.testCode),
      }))
    );

    const org: any = await Organization.create({
      organizationName: 'MetroCare Health TPA',
      contactPerson: 'David Miller',
      mobile: '9899887766',
      email: 'claims@metrocare.com',
      contractRate: 'Corporate',
      discount: 15,
      creditLimit: 50000,
      paymentTerms: 'Net 30',
      status: 'Active',
    });

    const patient: any = await Patient.create({
      uhid: 'UHID-2026-000001',
      patientName: 'Jane Doe',
      gender: 'Female',
      age: 32,
      mobile: '9123456789',
      referringDoctor: doctor._id,
      organization: org._id,
      status: 'Active',
    });

    const invoice: any = await Invoice.create({
      invoiceNumber: 'INV-2026-000001',
      patient: patient._id,
      uhid: patient.uhid,
      referringDoctor: doctor._id,
      organization: org._id,
      items: [
        {
          test: tests[0]._id,
          testCode: tests[0].testCode,
          testName: tests[0].testName,
          department: depts[2]._id,
          departmentName: depts[2].departmentName,
          rate: tests[0].rate,
          discountAmount: 50,
          netAmount: 450,
        },
      ],
      subtotal: 500,
      discountType: 'Fixed',
      discountValue: 50,
      netAmount: 450,
      paidAmount: 450,
      dueAmount: 0,
      paymentStatus: 'Paid',
      paymentMethod: 'UPI',
      barcode: 'BAR-2026-000001',
      createdBy: {
        userId: adminUser._id,
        name: adminUser.name,
      },
    });

    await Payment.create({
      receiptNumber: 'REC-2026-000001',
      invoice: invoice._id,
      patient: patient._id,
      amount: 450,
      paymentMethod: 'UPI',
      receivedBy: {
        userId: adminUser._id,
        name: adminUser.name,
      },
    });

    await Sample.create([
      {
        sampleId: 'SMP-2026-000001',
        barcode: 'BAR-2026-000001',
        invoice: invoice._id,
        patient: patient._id,
        uhid: patient.uhid,
        test: tests[0]._id,
        testCode: tests[0].testCode,
        testName: tests[0].testName,
        department: depts[2]._id,
        sampleType: tests[0].sampleType,
        sampleContainer: tests[0].sampleContainer,
        status: 'Processing',
        collectionDate: new Date(),
        collectionTime: new Date().toLocaleTimeString(),
        collector: techUser.name,
      },
    ]);

    await Appointment.create([
      {
        appointmentId: 'APT-2026-000001',
        patient: patient._id,
        patientName: patient.patientName,
        mobile: patient.mobile,
        doctor: doctor._id,
        tests: [tests[0]._id, tests[1]._id],
        date: new Date(),
        time: '09:30 AM',
        collectionType: 'Home Collection',
        address: '742 Evergreen Terrace, Springfield',
        phlebotomist: {
          userId: techUser._id,
          name: techUser.name,
          mobile: techUser.mobile,
        },
        status: 'On The Way',
        notes: 'Ring doorbell twice upon arrival.',
      },
      {
        appointmentId: 'APT-2026-000002',
        patientName: 'Michael Scott',
        mobile: '9988776655',
        doctor: doctor._id,
        tests: [tests[1]._id],
        date: new Date(),
        time: '11:00 AM',
        collectionType: 'Lab Visit',
        status: 'Confirmed',
        notes: 'Patient requesting expedited fasting report.',
      },
    ]);

    // Outgoing cash: the ambulance run the front desk settled from the drawer
    // alongside a routine supplier payment the Admin cleared.
    await Payout.create([
      {
        expenseId: 'EXP-2026-000001',
        payeeType: 'Reagents & Consumables',
        payeeName: 'Medisys Diagnostics Supply',
        category: 'Reagents & Consumables',
        description: 'EDTA vials and syringes, batch #84',
        amount: 2500,
        paymentMethod: 'Bank Transfer',
        expenseDate: new Date(),
        status: 'Paid',
        recordedBy: { userId: adminUser._id, name: adminUser.name, role: adminUser.role },
        approvedBy: { userId: adminUser._id, name: adminUser.name, role: adminUser.role, at: new Date() },
      },
      {
        expenseId: 'EXP-2026-000002',
        payeeType: 'Ambulance',
        payeeName: 'Sharma Ambulance Service',
        payeeContact: '9876500011',
        category: 'Ambulance',
        description: 'Home sample pickup - Sector 12 round trip',
        amount: 800,
        paymentMethod: 'Cash',
        expenseDate: new Date(),
        status: 'Paid',
        recordedBy: { userId: receptionUser._id, name: receptionUser.name, role: receptionUser.role },
        approvedBy: { userId: receptionUser._id, name: receptionUser.name, role: receptionUser.role, at: new Date() },
      },
    ]);

    // The demo rows above were written with hand-picked ids; advance every
    // sequence past them so the first record a user creates gets a fresh
    // number rather than a duplicate-key error.
    await Counter.insertMany([
      { name: 'uhid', seq: 1 },
      { name: 'invoice', seq: 1 },
      { name: 'receipt', seq: 1 },
      { name: 'sample', seq: 1 },
      { name: 'barcode', seq: 1 },
      { name: 'result', seq: 1 },
      { name: 'appointment', seq: 1 },
      { name: 'refund', seq: 0 },
      { name: 'expense', seq: 2 },
    ]);

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

export default seedDatabase;

if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
