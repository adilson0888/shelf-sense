export interface Formatter {
  t: (key: string, params?: Record<string, string | number>) => string;
  tPlural: (keyBase: string, count: number, params?: Record<string, string | number>) => string;
  formatDate: (dateISO: string, options?: Intl.DateTimeFormatOptions) => string;
  formatList: (items: string[], options?: Intl.ListFormatOptions) => string;
}
