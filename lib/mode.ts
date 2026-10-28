export function isDemoMode(): boolean {
  return process.env.APP_MODE?.trim().toLowerCase() === "demo";
}

export function configuredPassword(): string {
  if (isDemoMode()) return process.env.DEMO_PASSWORD ?? "";
  return process.env.DASHBOARD_PASSWORD ?? "";
}
