export const fmtB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

/**
 * Format date as DD/MM/YYYY (standard for this app)
 * @param dateInput - ISO string, Date object, or YYYY-MM-DD string
 * @returns Formatted date string in DD/MM/YYYY format
 */
export const formatDateDDMMYYYY = (dateInput: string | Date): string => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/**
 * Format date with time as DD/MM/YYYY HH:mm (standard for this app)
 * @param dateInput - ISO string, Date object, or YYYY-MM-DD string
 * @returns Formatted datetime string in DD/MM/YYYY HH:mm format
 */
export const formatDateTimeDDMMYYYY = (dateInput: string | Date): string => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD for input[type="date"] value
 * @param ddmmyyyy - Date string in DD/MM/YYYY format
 * @returns Date string in YYYY-MM-DD format for HTML input
 */
export const convertToInputDate = (ddmmyyyy: string): string => {
  if (!ddmmyyyy) return '';
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Convert YYYY-MM-DD (from input[type="date"]) to DD/MM/YYYY for display
 * @param yyyymmdd - Date string in YYYY-MM-DD format
 * @returns Date string in DD/MM/YYYY format
 */
export const convertFromInputDate = (yyyymmdd: string): string => {
  if (!yyyymmdd) return '';
  const [yyyy, mm, dd] = yyyymmdd.split('-');
  if (!dd || !mm || !yyyy) return '';
  return `${dd}/${mm}/${yyyy}`;
};