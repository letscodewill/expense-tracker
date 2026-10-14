export function recoveryErrorMessage(error: { code?: string; status?: number; message?: string }): string {
  if (error.code === 'over_email_send_rate_limit' && /after\s+\d+\s+seconds/i.test(error.message ?? '')) {
    return 'Aguarde pelo menos um minuto antes de pedir outro link. Verifique também sua caixa de entrada e spam.'
  }
  if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
    return 'Limite de solicitações atingido. Aguarde um pouco antes de tentar novamente e verifique sua caixa de entrada e spam.'
  }
  return 'Não foi possível enviar o email de recuperação.'
}
