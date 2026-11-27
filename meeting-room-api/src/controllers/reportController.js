function reportController(reportService) {
  return {
    async roomUtilization(req, res) {
      res.json(await reportService.roomUtilization(req.query));
    },
  };
}

module.exports = { reportController };
