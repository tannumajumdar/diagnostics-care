-- The photo from a verified ABHA, as a data: URI. Optional; the app leaves it out of every query but the profile.
ALTER TABLE "Patient" ADD COLUMN "photo" TEXT NOT NULL DEFAULT '';
