import React from 'react';
import { Sale, StoreSettings, Customer } from '../types';
import {
  computeAggregateWarrantyDays,
  formatDynamicWarrantyTerms,
  formatWarrantyLabel
} from '../utils/warrantyHelpers';

interface SaleReceiptDocumentProps {
  sale: Sale;
  storeSettings?: Partial<StoreSettings>;
  customer?: Customer;
  viaLabel?: string;
  isPublicView?: boolean;
}

export const SaleReceiptDocument: React.FC<SaleReceiptDocumentProps> = ({
  sale,
  storeSettings,
  customer,
  viaLabel = 'RECIBO DE VENDA',
  isPublicView = false
}) => {
  const store = storeSettings || {};
  const saleWarrantyDays =
    sale.warrantyDays !== undefined && sale.warrantyDays !== null
      ? Math.max(0, Number(sale.warrantyDays))
      : computeAggregateWarrantyDays(sale.items || []);

  const customerCpf =
    (sale as any).customerCpfMasked ||
    sale.customerCpf ||
    customer?.document ||
    (customer as any)?.cpfCnpj ||
    'NÃO INFORMADO';

  const customerAddress =
    sale.customerAddress ||
    (customer
      ? [
          customer.street,
          customer.number,
          customer.neighborhood,
          customer.city ? `${customer.city}/${customer.state || ''}` : ''
        ]
          .filter(Boolean)
          .join(', ')
      : 'NÃO INFORMADO');

  const storeAddress = [
    store.street,
    store.number,
    store.neighborhood,
    store.city ? `${store.city}/${store.state || ''}` : ''
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <div
      className="w-full p-4 sm:p-5 text-[10.5px] leading-snug bg-white text-slate-900 flex flex-col justify-between min-h-[110mm] h-auto font-sans"
      style={{ width: '100%', boxSizing: 'border-box' }}
    >
      <div>
        {/* Header Compacto da Venda */}
        <div className="border-b border-slate-200 pb-2 mb-2 flex justify-between items-start gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded border border-slate-200 p-0.5 flex items-center justify-center shrink-0 bg-white shadow-xs">
              <img src="/logo.png" alt="Power Tech Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight uppercase text-blue-900 leading-none mb-0.5">
                {store.storeName || store.tradeName || 'Power Tech - Assistência Técnica & Vendas'}
              </h2>
              <p className="text-[9.5px] font-semibold text-slate-700">
                {store.cnpj ? `CNPJ: ${store.cnpj}` : ''} {store.ie ? `| IE: ${store.ie}` : ''}
              </p>
              {storeAddress && (
                <p className="text-[9px] text-slate-600 break-words max-w-[150mm] leading-tight">
                  {storeAddress}
                </p>
              )}
              <p className="text-[9px] text-slate-600">
                {store.phone ? `Tel/WhatsApp: ${store.phone}` : ''} {store.pixKey ? `| Chave PIX: ${store.pixKey}` : ''}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`inline-block px-2.5 py-0.5 font-bold rounded text-[9.5px] uppercase tracking-wide mb-0.5 ${
                sale.status === 'cancelada' ? 'bg-rose-700 text-white' : 'bg-emerald-700 text-white'
              }`}
            >
              {sale.status === 'cancelada' ? 'CANCELADO' : viaLabel}
            </span>
            <p className="text-base font-black text-slate-900 leading-none">
              RECIBO #{sale.number}
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {new Date(sale.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {sale.status === 'cancelada' && (
          <div className="mb-2 p-1.5 bg-rose-50 border border-rose-300 text-rose-700 text-[10.5px] font-black uppercase text-center rounded tracking-wider">
            *** VENDA CANCELADA / ESTORNADA ***
          </div>
        )}

        {/* Dados do Consumidor e Condição de Pagamento */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 mb-2 text-[10px]">
          <div>
            <p>
              <strong className="font-bold text-slate-700">CLIENTE:</strong>{' '}
              <span className="font-semibold text-slate-900">{sale.customerName || 'CONSUMIDOR FINAL'}</span>
            </p>
            <p>
              <strong className="font-bold text-slate-700">CPF/CNPJ:</strong>{' '}
              <span className="font-semibold text-slate-800">{customerCpf}</span>
            </p>
            <p className="break-words leading-tight max-w-[120mm]">
              <strong className="font-bold text-slate-700">ENDEREÇO:</strong>{' '}
              <span className="text-slate-800">{customerAddress}</span>
            </p>
            <p>
              <strong className="font-bold text-slate-700">EMISSÃO:</strong>{' '}
              <span className="text-slate-800">{new Date(sale.createdAt).toLocaleString('pt-BR')}</span>
            </p>
          </div>
          <div className="text-right">
            <p>
              <strong className="font-bold text-slate-700">FORMA DE PAGAMENTO:</strong>{' '}
              <span className="uppercase font-bold text-emerald-800">{sale.paymentMethod}</span>
            </p>
            <p className="text-[9px] text-slate-600">
              {sale.installments && sale.installments > 1
                ? `PARCELADO EM ${sale.installments}X NO CARTÃO`
                : 'PAGAMENTO À VISTA'}
              {sale.changeAmount && sale.changeAmount > 0
                ? ` (TROCO: R$ ${Number(sale.changeAmount).toFixed(2)})`
                : ''}
            </p>
          </div>
        </div>

        {/* Tabela de Itens Vendidos */}
        <div className="mb-2">
          <table className="w-full border-collapse border border-slate-200 text-[10px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-left font-bold text-slate-800">
                <th className="p-1 px-1.5 border-r border-slate-200 w-16">Cód</th>
                <th className="p-1 px-1.5 border-r border-slate-200">Produto / Peça / Serviço</th>
                <th className="p-1 px-1.5 border-r border-slate-200 text-center w-10">Qtd</th>
                <th className="p-1 px-1.5 border-r border-slate-200 text-right w-20">Vl. Unit.</th>
                <th className="p-1 px-1.5 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items || []).map((it, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-1 px-1.5 border-r border-slate-200 font-mono text-[9px] text-slate-600">
                    {it.code || (it as any).id || '-'}
                  </td>
                  <td className="p-1 px-1.5 border-r border-slate-200 font-medium text-slate-900 break-words whitespace-normal leading-snug">
                    {it.productName || (it as any).description || 'Item'}
                    {it.warrantyDays !== undefined && (
                      <span className="block text-[8px] text-slate-500 font-normal">
                        Garantia: {formatWarrantyLabel(it.warrantyDays)}
                      </span>
                    )}
                  </td>
                  <td className="p-1 px-1.5 border-r border-slate-200 text-center text-slate-800 font-semibold">
                    {it.quantity}
                  </td>
                  <td className="p-1 px-1.5 border-r border-slate-200 text-right text-slate-800">
                    R$ {Number(it.unitPrice).toFixed(2)}
                  </td>
                  <td className="p-1 px-1.5 text-right font-bold text-slate-900">
                    R$ {Number(it.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t border-slate-200 font-bold text-[10px]">
                <td colSpan={3} className="p-1 px-1.5 text-left text-slate-700">
                  SUBTOTAL: R$ {Number(sale.subtotal || sale.total).toFixed(2)}
                  {sale.discount > 0 && (
                    <span className="text-rose-600 ml-2 font-bold">
                      DESCONTO: -R$ {Number(sale.discount).toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="p-1 px-1.5 text-right font-bold text-slate-800 text-[10.5px]">TOTAL PAGO:</td>
                <td className="p-1 px-1.5 text-right font-black text-slate-900 text-xs">
                  R$ {Number(sale.total).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Rodapé: Observação e Termos de Garantia */}
      <div>
        {sale.notes && (
          <p className="text-[8.5px] leading-tight text-slate-800 bg-amber-50 p-1 rounded border border-amber-200 mb-1">
            <strong>OBSERVAÇÕES:</strong> {sale.notes}
          </p>
        )}

        <p className="text-[8.5px] leading-tight text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
          <strong>TERMO DE GARANTIA:</strong> {formatDynamicWarrantyTerms(saleWarrantyDays, store.warrantyTerms, 'sale')}
        </p>
      </div>
    </div>
  );
};
