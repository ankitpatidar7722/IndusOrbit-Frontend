// GST State Code ("State TIN No") for an Indian state / UT — the 2-digit prefix of every GSTIN.

const CODES: Record<string, string> = {
  jammuandkashmir: "01", himachalpradesh: "02", punjab: "03", chandigarh: "04", uttarakhand: "05", uttaranchal: "05",
  haryana: "06", delhi: "07", nctofdelhi: "07", newdelhi: "07", rajasthan: "08", uttarpradesh: "09", bihar: "10",
  sikkim: "11", arunachalpradesh: "12", nagaland: "13", manipur: "14", mizoram: "15", tripura: "16", meghalaya: "17",
  assam: "18", westbengal: "19", jharkhand: "20", odisha: "21", orissa: "21", chhattisgarh: "22", madhyapradesh: "23",
  gujarat: "24", damananddiu: "26", dadraandnagarhaveli: "26", dadraandnagarhavelianddamananddiu: "26",
  maharashtra: "27", karnataka: "29", goa: "30", lakshadweep: "31", kerala: "32", tamilnadu: "33",
  puducherry: "34", pondicherry: "34", andamanandnicobarislands: "35", telangana: "36", andhrapradesh: "37", ladakh: "38",
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/** State TIN No from the state name; falls back to the GSTIN's 2-digit prefix. "" when unknown. */
export function gstStateCode(state?: string | null, gstin?: string | null): string {
  const byState = state ? CODES[norm(state)] : undefined;
  if (byState) return byState;
  const m = /^(\d{2})[0-9A-Z]{13}$/i.exec((gstin ?? "").trim());
  return m ? m[1] : "";
}
