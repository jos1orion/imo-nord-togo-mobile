import { describe, expect, it } from '@jest/globals';
import { translate, type TranslationKey } from '../index';
import { translateAdmin } from '../admin';

describe('translate', () => {
  it('resolves legacy uppercase translation keys', () => {
    expect(translate('fr', 'PROFILE_AGENT_MARK_RENTED' as TranslationKey)).toBe(
      'Confirmer la location'
    );
    expect(translate('fr', 'PROFILE_AGENT_MARK_SOLD' as TranslationKey)).toBe(
      'Confirmer la vente'
    );
  });

  it('returns localized agent transaction actions in both supported languages', () => {
    expect(translate('fr', 'profile_agent_complete_action')).toBe('Vendre / louer');
    expect(translate('en', 'profile_agent_complete_action')).toBe('Sell / rent');
  });

  it('localizes draft and admin rejection dialogs in both supported languages', () => {
    expect(translate('fr', 'publish_draft_available_title')).toBe('Brouillon disponible');
    expect(translate('en', 'publish_draft_available_title')).toBe('Draft available');
    expect(translateAdmin('fr', 'Motif du refus')).toBe('Motif du refus');
    expect(translateAdmin('en', 'Motif du refus')).toBe('Rejection reason');
    expect(translateAdmin('en', 'Informations incomplètes.')).toBe('Incomplete information.');
  });
});
