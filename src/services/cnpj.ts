export interface CNPJData {
  cnpj: string;
  formattedCnpj: string;
  name: string;
  razaoSocial: string;
  nomeFantasia: string;
  phone: string;
  whatsapp: string;
  email: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  address: string;
  stateRegistration?: string;
  status: string;
  openingDate?: string;
  cnae?: string;
  legalNature?: string;
  porte?: string;
  tipo?: string;
  simplesNacional?: string;
  mei?: string;
  partners?: string;
}

export function cleanDigits(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

export function formatCNPJ(value?: string | null): string {
  const digits = cleanDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Consulta dados cadastrais completos de CNPJ na Receita Federal
 * com failover quádruplo (Backend local -> Minha Receita -> Brasil API)
 */
export async function lookupCNPJ(rawCnpj: string): Promise<CNPJData | null> {
  const clean = cleanDigits(rawCnpj);
  if (clean.length !== 14) return null;

  const formattedCnpj = formatCNPJ(clean);

  // 1. Tentar via backend local (/api/cnpj/:cnpj)
  try {
    const res = await fetch(`http://localhost:4567/api/cnpj/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.name || data.razaoSocial)) {
        return {
          ...data,
          formattedCnpj: data.formattedCnpj || formattedCnpj
        } as CNPJData;
      }
    }
  } catch (err) {
    // Ignora erro local e tenta fallback externo direto
  }

  // 2. Fallback direto: Minha Receita (https://minhareceita.org)
  try {
    const res = await fetch(`https://minhareceita.org/${clean}`);
    if (res.ok) {
      const r = await res.json();
      const phone = [r.ddd_telefone_1, r.ddd_telefone_2].filter(Boolean)[0] || '';
      const formattedPhone = phone
        ? phone.replace(/\D/g, '').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
        : '';

      const street = [r.descricao_tipo_de_logradouro, r.logradouro].filter(Boolean).join(' ').trim().toUpperCase() || (r.logradouro || '').trim().toUpperCase();
      const num = (r.numero || 'S/N').trim().toUpperCase();
      const comp = (r.complemento || '').trim().toUpperCase();
      const neigh = (r.bairro || '').trim().toUpperCase();
      const city = (r.municipio || '').trim().toUpperCase();
      const uf = (r.uf || '').trim().toUpperCase();
      const cep = (r.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');

      let openingDate = r.data_inicio_atividade || '';
      if (openingDate && openingDate.includes('-') && openingDate.length >= 10) {
        const [y, m, d] = openingDate.split('T')[0].split('-');
        openingDate = `${d}/${m}/${y}`;
      }

      const cnae = r.cnae_fiscal && r.cnae_fiscal_descricao
        ? `${r.cnae_fiscal} - ${r.cnae_fiscal_descricao}`.toUpperCase()
        : (r.cnae_fiscal_descricao || '').toUpperCase();

      let partners = '';
      if (Array.isArray(r.qsa) && r.qsa.length > 0) {
        partners = r.qsa
          .map((s: any) => `${s.nome_socio || s.nome || ''}${s.qualificacao_socio ? ` (${s.qualificacao_socio})` : ''}`.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
      }

      const addressParts = [
        street ? `${street}, ${num}` : '',
        comp,
        neigh,
        city && uf ? `${city} - ${uf}` : city || uf,
        cep ? `CEP: ${cep}` : ''
      ].filter(Boolean);

      return {
        cnpj: clean,
        formattedCnpj,
        name: (r.razao_social || r.nome_fantasia || '').trim().toUpperCase(),
        razaoSocial: (r.razao_social || '').trim().toUpperCase(),
        nomeFantasia: (r.nome_fantasia || r.razao_social || '').trim().toUpperCase(),
        stateRegistration: (r.inscricao_estadual || r.ie || 'ISENTO').trim().toUpperCase(),
        phone: formattedPhone,
        whatsapp: formattedPhone,
        email: (r.email || '').trim().toLowerCase(),
        street,
        number: num,
        complement: comp,
        neighborhood: neigh,
        city,
        state: uf,
        cep,
        address: addressParts.join(', ').toUpperCase(),
        status: (r.descricao_situacao_cadastral || 'ATIVA').trim().toUpperCase(),
        openingDate,
        cnae,
        legalNature: (r.natureza_juridica || '').trim().toUpperCase(),
        porte: (r.porte || '').trim().toUpperCase(),
        tipo: (r.descricao_identificador_matriz_filial || '').trim().toUpperCase(),
        simplesNacional: r.opcao_pelo_simples === true ? 'SIM' : r.opcao_pelo_simples === false ? 'NÃO' : 'NÃO OPTANTE',
        mei: r.data_opcao_pelo_mei ? 'SIM' : 'NÃO',
        partners
      };
    }
  } catch (err) {
    // Ignora e tenta Brasil API
  }

  // 3. Fallback direto 2: Brasil API
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (res.ok) {
      const b = await res.json();
      const phone = [b.ddd_telefone_1, b.ddd_telefone_2].filter(Boolean)[0] || '';
      const formattedPhone = phone
        ? phone.replace(/\D/g, '').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
        : '';

      const street = [b.descricao_tipo_de_logradouro, b.logradouro].filter(Boolean).join(' ').trim().toUpperCase() || (b.logradouro || '').trim().toUpperCase();
      const num = (b.numero || 'S/N').trim().toUpperCase();
      const comp = (b.complemento || '').trim().toUpperCase();
      const neigh = (b.bairro || '').trim().toUpperCase();
      const city = (b.municipio || '').trim().toUpperCase();
      const uf = (b.uf || '').trim().toUpperCase();
      const cep = (b.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');

      let openingDate = b.data_inicio_atividade || b.abertura || '';
      if (openingDate && openingDate.includes('-') && openingDate.length >= 10) {
        const [y, m, d] = openingDate.split('T')[0].split('-');
        openingDate = `${d}/${m}/${y}`;
      }

      const cnae = b.cnae_fiscal && b.cnae_fiscal_descricao
        ? `${b.cnae_fiscal} - ${b.cnae_fiscal_descricao}`.toUpperCase()
        : (b.cnae_fiscal_descricao || '').toUpperCase();

      let partners = '';
      if (Array.isArray(b.qsa) && b.qsa.length > 0) {
        partners = b.qsa
          .map((s: any) => `${s.nome_socio || s.nome || ''}${s.qual ? ` (${s.qual})` : ''}`.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
      }

      const addressParts = [
        street ? `${street}, ${num}` : '',
        comp,
        neigh,
        city && uf ? `${city} - ${uf}` : city || uf,
        cep ? `CEP: ${cep}` : ''
      ].filter(Boolean);

      return {
        cnpj: clean,
        formattedCnpj,
        name: (b.razao_social || b.nome_fantasia || '').trim().toUpperCase(),
        razaoSocial: (b.razao_social || '').trim().toUpperCase(),
        nomeFantasia: (b.nome_fantasia || b.razao_social || '').trim().toUpperCase(),
        stateRegistration: (b.inscricao_estadual || b.ie || 'ISENTO').trim().toUpperCase(),
        phone: formattedPhone,
        whatsapp: formattedPhone,
        email: (b.email || '').trim().toLowerCase(),
        street,
        number: num,
        complement: comp,
        neighborhood: neigh,
        city,
        state: uf,
        cep,
        address: addressParts.join(', ').toUpperCase(),
        status: (b.descricao_situacao_cadastral || 'ATIVA').trim().toUpperCase(),
        openingDate,
        cnae,
        legalNature: (b.natureza_juridica || '').trim().toUpperCase(),
        porte: (b.porte || '').trim().toUpperCase(),
        tipo: (b.descricao_identificador_matriz_filial || '').trim().toUpperCase(),
        simplesNacional: b.opcao_pelo_simples === true ? 'SIM' : b.opcao_pelo_simples === false ? 'NÃO' : 'NÃO OPTANTE',
        mei: b.data_opcao_pelo_mei ? 'SIM' : 'NÃO',
        partners
      };
    }
  } catch (err) {
    // Falha
  }

  return null;
}
