export {};

declare global {
  interface Window {
    /** Report data injected by src/build_report.py (see reports/report_data.json for the shape). */
    __IBM_DATA__: any;
  }
}
