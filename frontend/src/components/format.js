const integer = new Intl.NumberFormat('en-IN');
const decimal = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const number = value => Number.isFinite(value) ? integer.format(value) : 'Unavailable';
export const score = value => Number.isFinite(value) ? decimal.format(value) : 'Unavailable';
export const percent = value => Number.isFinite(value) ? score(value) + '%' : 'Unavailable';
