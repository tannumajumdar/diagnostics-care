-- Whether the patient brought an ABHA or asked for a new one, and the ID proof seen at the desk. All optional.
ALTER TABLE "Patient" ADD COLUMN "abhaStatus" TEXT NOT NULL DEFAULT '',
                      ADD COLUMN "idProofType" TEXT NOT NULL DEFAULT '',
                      ADD COLUMN "idProofNumber" TEXT NOT NULL DEFAULT '';
