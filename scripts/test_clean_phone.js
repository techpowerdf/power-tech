function cleanPhoneNumber(rawPhone, defaultDdd = '61') {
  if (!rawPhone) return '';
  let str = String(rawPhone).trim();

  // Ignora valores inválidos comuns
  const lower = str.toLowerCase();
  if (['undefined', 'null', 'n/a', 'nao informado', 'não informado', 'nenhum', '0'].includes(lower)) {
    return '';
  }

  // Se houver múltiplos telefones separados por barra, vírgula, ponto e vírgula ou "ou"
  const parts = str.split(/[\/,;|\n]|\s+ou\s+|\s+e\s+/i);
  let candidate = str;
  for (const part of parts) {
    const digitsOnly = part.replace(/\D/g, '');
    // Procura o primeiro que seja celular (9 dígitos ou 11 com ddd) ou fixo com DDD
    if (digitsOnly.length >= 8) {
      candidate = part;
      break;
    }
  }

  let digits = candidate.replace(/\D/g, '');

  // Remove zero à esquerda do DDD (ex: 061988887777 -> 61988887777)
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.substring(1);
  }

  // Se já tiver 12 ou 13 dígitos começando com 55 (Brasil)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  // DDD (2 dígitos) + Telefone (8 ou 9 dígitos) -> 10 ou 11 dígitos
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se o lojista cadastrou apenas o número local (8 ou 9 dígitos sem DDD)
  if ((digits.length === 8 || digits.length === 9) && defaultDdd) {
    const cleanDdd = defaultDdd.replace(/\D/g, '').slice(-2);
    if (cleanDdd.length === 2) {
      return `55${cleanDdd}${digits}`;
    }
  }

  return digits;
}

const cases = [
  'undefined',
  'null',
  '(61) 3226-6883 / (61) 3327-1723',
  '(61) 3226-6883 / (61) 98888-7777',
  '61 99999-8888',
  '99999-8888',
  '9999-8888',
  '011 98888-7777',
  '+55 (11) 98888-7777',
  '5511988887777',
  '(11) 98888-7777; (11) 97777-6666',
  '61988887777 ou 61977778888'
];

cases.forEach(c => {
  console.log(`"${c}" => "${cleanPhoneNumber(c, '61')}"`);
});
