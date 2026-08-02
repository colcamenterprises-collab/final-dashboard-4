import {
  extractScbStatementTextFields,
  legacyScbCombinedDescription,
} from './scbFixedWidthStatementParser';
import {
  extractMerchantSuggestion,
  generateBankImportDedupeKey,
} from './bankImportNormalization';

export interface ScbRepairCandidate {
  source: string;
  postedAt: Date;
  amountTHB: number;
  description: string;
  supplier: string | null;
  notes: string | null;
  status: string;
  dedupeKey: string;
  raw: Record<string, unknown>;
}

export type ScbRepairPlan =
  | { outcome: 'already_correct' | 'skip_edited' | 'skip_non_pending' | 'skip_unexpected' }
  | {
      outcome: 'repair';
      next: {
        description: string;
        supplier: string | null;
        notes: string | null;
        dedupeKey: string;
        raw: Record<string, unknown>;
      };
    };

export function planScbStatementFieldRepair(candidate: ScbRepairCandidate): ScbRepairPlan {
  const raw = candidate.raw && typeof candidate.raw === 'object' ? candidate.raw : {};
  const statementLine = typeof raw.statementLine === 'string' ? raw.statementLine : '';
  const continuationLines = Array.isArray(raw.continuationLines)
    ? raw.continuationLines.filter((line): line is string => typeof line === 'string')
    : [];
  const ownerEditAudit = Array.isArray(raw.ownerEditAudit) ? raw.ownerEditAudit : [];

  if (candidate.status !== 'pending') return { outcome: 'skip_non_pending' };
  if (ownerEditAudit.length > 0) return { outcome: 'skip_edited' };
  if (!statementLine) return { outcome: 'skip_unexpected' };

  const fields = extractScbStatementTextFields(statementLine, continuationLines);
  const legacyDescription = legacyScbCombinedDescription(statementLine, continuationLines);
  if (!fields.description || ![legacyDescription, fields.description].includes(candidate.description)) {
    return { outcome: 'skip_unexpected' };
  }

  const oldSupplierSuggestion = extractMerchantSuggestion(legacyDescription);
  const newSupplierSuggestion = extractMerchantSuggestion(fields.description);
  const nextSupplier = candidate.supplier === oldSupplierSuggestion
    ? newSupplierSuggestion
    : candidate.supplier;
  const nextNotes = candidate.notes || fields.note || null;
  const nextDedupeKey = generateBankImportDedupeKey(
    candidate.source,
    candidate.postedAt,
    candidate.amountTHB,
    fields.description,
    raw,
  );
  const changed = candidate.description !== fields.description
    || candidate.supplier !== nextSupplier
    || candidate.notes !== nextNotes
    || candidate.dedupeKey !== nextDedupeKey;

  if (!changed) return { outcome: 'already_correct' };

  return {
    outcome: 'repair',
    next: {
      description: fields.description,
      supplier: nextSupplier,
      notes: nextNotes,
      dedupeKey: nextDedupeKey,
      raw: {
        ...raw,
        descriptionRaw: fields.description,
        noteRaw: fields.note || null,
        systemRepairAudit: [
          ...(Array.isArray(raw.systemRepairAudit) ? raw.systemRepairAudit : []),
          {
            at: new Date().toISOString(),
            action: 'separate_scb_desc_and_note',
            previous: {
              description: candidate.description,
              supplier: candidate.supplier,
              notes: candidate.notes,
              dedupeKey: candidate.dedupeKey,
            },
            next: {
              description: fields.description,
              supplier: nextSupplier,
              notes: nextNotes,
              dedupeKey: nextDedupeKey,
            },
          },
        ],
      },
    },
  };
}
