import { createContext, useContext } from 'react';

export const CompaniesContext = createContext({
  companies: [],
  loading: false,
  error: '',
  refreshCompanies: () => {},
  recentTickers: [],
  recordRecentTicker: () => {},
});

export function useCompanies() {
  return useContext(CompaniesContext);
}
