import { describe, expect, it } from '@jest/globals';
import { resolveSmartGuideTopic, type SmartGuideTopic } from '../smartGuide';

describe('resolveSmartGuideTopic', () => {
  const topicCases: [string, SmartGuideTopic][] = [
    ['Comment publier une maison ?', 'publish'],
    ['Comment ajouter des photos ?', 'photos'],
    ['Comment modifier mon annonce ?', 'edit'],
    ['Comment supprimer mon bien ?', 'delete'],
    ['Comment contacter le propriétaire ?', 'contact'],
    ['Où retrouver mes favoris ?', 'favorites'],
    ['Pourquoi mon annonce n’apparaît pas ?', 'moderation'],
    ['Comment louer cette maison ?', 'transaction'],
    ['Quel est le prix ?', 'price'],
  ];

  it.each(topicCases)('maps "%s" to %s', (question, expected) => {
    expect(resolveSmartGuideTopic(question)).toBe(expected);
  });

  it('uses the screen context for an empty question', () => {
    expect(resolveSmartGuideTopic('', 'publish')).toBe('publish');
    expect(resolveSmartGuideTopic('', 'property')).toBe('contact');
  });

  it('does not make up an answer for an unsupported question', () => {
    expect(resolveSmartGuideTopic('Quelle sera la meteo demain ?')).toBe('unknown');
  });
});
