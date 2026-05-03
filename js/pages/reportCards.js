// Report cards now use the full grade-record workspace so there is one source
// for adding grades, weights, student records, CSV export, and PDF reports.
export { renderGrades as renderReportCards, attachGradeEvents as attachReportCardsEvents } from './grades.js?v=20260503-merged-report-cards';
