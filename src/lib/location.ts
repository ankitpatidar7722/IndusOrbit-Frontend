// Cascading Country → State → City option lists, backed by `country-state-city`.
//
// ⚠️ That package's city dataset is ~7.7 MB. To keep it OUT of the initial route bundle it is
// loaded via a DYNAMIC import (webpack splits it into its own async chunk) the first time a form
// with location fields mounts — call `useLocationData()` once in such a component so it re-renders
// when the data arrives. Until then the helpers return just the current value (nothing is lost).
//
// Values are stored/emitted as human-readable NAMES ("India", "Madhya Pradesh", "Indore") for
// backend compatibility; each helper merges the current value in so an existing record whose value
// doesn't match the library's spelling is still preserved and pre-selected.
import { useEffect, useState } from "react";

type Nm = string | null | undefined;
// The module's type, resolved without importing it at runtime (kept lazy — see below).
type CSCModule = typeof import("country-state-city");

let mod: CSCModule | null = null;
let loading: Promise<CSCModule> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<CSCModule> {
  if (mod) return Promise.resolve(mod);
  if (!loading) {
    loading = import("country-state-city").then((m) => {
      mod = m;
      listeners.forEach((fn) => fn());
      return m;
    });
  }
  return loading;
}

/**
 * Trigger the (lazy) country/state/city data load and re-render when it's ready.
 * Call once at the top of any component that renders the location dropdowns.
 * Returns true once the dataset is available.
 */
export function useLocationData(): boolean {
  const [ready, setReady] = useState(mod != null);
  useEffect(() => {
    if (mod) { setReady(true); return; }
    const fn = () => setReady(true);
    listeners.add(fn);
    void load();
    return () => { listeners.delete(fn); };
  }, []);
  return ready;
}

function withCurrent(list: string[], current?: Nm): string[] {
  const t = (current ?? "").trim();
  return t && !list.includes(t) ? [t, ...list] : list;
}

/** All country names (current value kept even if unknown / data not yet loaded). */
export function countryNames(current?: Nm): string[] {
  if (!mod) return withCurrent([], current);
  return withCurrent(mod.Country.getAllCountries().map((c) => c.name), current);
}

/** States of the given country (by name). Empty when the country is unknown/blank/unloaded. */
export function stateNames(countryName?: Nm, current?: Nm): string[] {
  if (!mod) return withCurrent([], current);
  const c = mod.Country.getAllCountries().find((x) => x.name === countryName);
  const list = c ? mod.State.getStatesOfCountry(c.isoCode).map((s) => s.name) : [];
  return withCurrent(list, current);
}

/** Cities of the given (country, state) by name. Empty until both are known and data is loaded. */
export function cityNames(countryName?: Nm, stateName?: Nm, current?: Nm): string[] {
  if (!mod) return withCurrent([], current);
  const c = mod.Country.getAllCountries().find((x) => x.name === countryName);
  if (!c) return withCurrent([], current);
  const s = mod.State.getStatesOfCountry(c.isoCode).find((x) => x.name === stateName);
  const list = s ? mod.City.getCitiesOfState(c.isoCode, s.isoCode).map((ci) => ci.name) : [];
  return withCurrent(list, current);
}
