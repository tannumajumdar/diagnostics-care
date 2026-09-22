import { Request, Response, NextFunction } from 'express';
import { TestPackage } from '../models/package.model';
import { LabTest } from '../models/test.model';
import { Invoice } from '../models/invoice.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';

/**
 * What the tests inside a panel would have cost one by one. The desk needs
 * both figures side by side - a package price only reads as an offer next to
 * the sum it replaces.
 */
const listTotalOf = (tests: any[]): number =>
  tests.reduce((sum, test) => sum + (Number(test?.rate) || 0), 0);

const referralTotalOf = (tests: any[]): number =>
  tests.reduce((sum, test) => sum + (Number(test?.referralRate) || Number(test?.rate) || 0), 0);

/** The shape every package endpoint answers with. */
const shape = (pkg: any) => {
  const tests = Array.isArray(pkg.tests) ? pkg.tests : [];
  const filled = tests.filter((t: any) => t && typeof t === 'object' && t.testName);

  return {
    id: pkg._id.toString(),
    _id: pkg._id.toString(),
    packageName: pkg.packageName,
    packageCode: pkg.packageCode,
    description: pkg.description,
    rate: pkg.rate,
    referralRate: pkg.referralRate,
    discountAllowed: pkg.discountAllowed,
    status: pkg.status,
    tests: filled.map((t: any) => ({
      id: t._id.toString(),
      _id: t._id.toString(),
      testName: t.testName,
      testCode: t.testCode,
      rate: t.rate,
      patientRate: t.patientRate,
      corporateRate: t.corporateRate,
      doctorRate: t.doctorRate,
      referralRate: t.referralRate,
      processingMode: t.processingMode,
      outsourceLab: t.outsourceLab,
      discountAllowed: t.discountAllowed,
      fastingRequired: t.fastingRequired,
      sampleContainer: t.sampleContainer,
      parameters: t.parameters,
      department:
        t.department && typeof t.department === 'object'
          ? { id: t.department._id.toString(), departmentName: t.department.departmentName }
          : t.department,
    })),
    testCount: tests.length,
    listTotal: listTotalOf(filled),
    referralListTotal: referralTotalOf(filled),
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
};

export class PackageController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status, page = 1, limit = 25 } = req.query;
      const filter: any = {};
      if (search) {
        filter.$or = [
          { packageName: { $regex: search, $options: 'i' } },
          { packageCode: { $regex: search, $options: 'i' } },
        ];
      }
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [packages, total] = await Promise.all([
        TestPackage.find(filter)
          .populate({ path: 'tests', populate: { path: 'department' } })
          .sort({ packageName: 1 })
          .skip(skip)
          .limit(Number(limit)),
        TestPackage.countDocuments(filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Test packages retrieved',
        data: packages.map(shape),
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pkg = await TestPackage.findById(id).populate({
        path: 'tests',
        populate: { path: 'department' },
      });
      if (!pkg) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Package not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Package retrieved', data: shape(pkg) });
    } catch (error) {
      next(error);
    }
  };

  /**
   * A package is only ever as good as the tests in it - one naming a test the
   * catalogue no longer has would bill a price against work nobody can run,
   * so the ids are checked before the panel is stored.
   */
  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = { ...req.body };
      const testIds: string[] = Array.from(new Set<string>(body.tests || []));

      const found = await LabTest.countDocuments({ _id: { $in: testIds } });
      if (found !== testIds.length) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'One or more tests in this package are no longer in the catalogue'
        );
      }

      body.tests = testIds;
      body.referralRate = Number(body.referralRate ?? 0);

      const pkg = await TestPackage.create(body);
      const withTests = await TestPackage.findById(pkg._id).populate({
        path: 'tests',
        populate: { path: 'department' },
      });

      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Test package created',
        data: shape(withTests),
      });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const body = { ...req.body };

      if (Array.isArray(body.tests)) {
        const testIds: string[] = Array.from(new Set<string>(body.tests));
        const found = await LabTest.countDocuments({ _id: { $in: testIds } });
        if (found !== testIds.length) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'One or more tests in this package are no longer in the catalogue'
          );
        }
        body.tests = testIds;
      }

      const pkg = await TestPackage.findByIdAndUpdate(id, body, { new: true }).populate({
        path: 'tests',
        populate: { path: 'department' },
      });
      if (!pkg) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Package not found');

      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test package updated', data: shape(pkg) });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pkg = await TestPackage.findById(id);
      if (!pkg) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Package not found');
      pkg.status = pkg.status === 'Active' ? 'Inactive' : 'Active';
      await pkg.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: shape(pkg) });
    } catch (error) {
      next(error);
    }
  };

  /**
   * The same rule the test master follows: a panel that has been billed stays
   * put, so the bills naming it keep reading correctly. Deactivating takes it
   * off the desk without rewriting history.
   */
  static remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pkg = await TestPackage.findById(id);
      if (!pkg) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Package not found');

      const billed = await Invoice.countDocuments({ 'items.packageId': pkg._id });
      if (billed) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          `${pkg.packageName} is already on ${billed} bill${billed > 1 ? 's' : ''} and cannot be deleted. ` +
            'Deactivate it instead - it comes off the billing screen and the history stays intact.'
        );
      }

      await pkg.deleteOne();
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `${pkg.packageName} deleted`,
        data: { id: String(pkg._id) },
      });
    } catch (error) {
      next(error);
    }
  };
}
