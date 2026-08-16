// Validação central de variáveis de ambiente do servidor.
// Falha rápido se a configuração obrigatória estiver ausente.

export function getEnv(name: string): string | undefined {
  return process.env[name];
}

export function isPluggyConfigured(): boolean {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getWebhookUrl(protocol: string, host: string | undefined): string {
  return (
    process.env.PLUGGY_WEBHOOK_URL ||
    `${protocol}://${host || 'localhost'}/api/pluggy/webhook`
  );
}