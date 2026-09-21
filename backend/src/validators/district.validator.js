export function validateDistrictId(req, res, next) {
  const rawId = req.params.id;
  const id = Number(rawId);

  // Prisma's MySQL Int is a signed 32-bit integer.
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id) || id > 2147483647) {
    const error = new Error('Invalid district ID');
    error.status = 400;
    return next(error);
  }

  res.locals.districtId = id;
  next();
}
