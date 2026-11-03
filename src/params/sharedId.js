export function match(param) {return /^[1-9][0-9]{0,15}$/.test(param) && Number.isSafeInteger(Number(param));}
