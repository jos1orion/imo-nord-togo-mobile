import { describe, expect, it } from '@jest/globals';
import {
  getFirstIncompletePublishStep,
  getFirstInvalidProgressionStep,
  getPublishStepErrors,
  type PublishField,
  type PublishFormValues,
} from '../smartPublishValidation';

const validForm: PublishFormValues = {
  title: 'Maison à Kara',
  price: '25000000',
  city: 'Kara',
  location: 'Centre',
  clientPhone: '90000000',
};

const messages: Record<PublishField, string> = {
  title: 'title required',
  price: 'valid price required',
  images: 'one image required',
  city: 'city required',
  location: 'neighborhood required',
  clientPhone: 'phone required',
};

const validate = (
  step: number,
  form = validForm,
  phone = '',
  imageCount = 1,
) => getPublishStepErrors(step, form, phone, imageCount, 8, messages);

describe('getPublishStepErrors', () => {
  it('blocks empty required fields on the first step', () => {
    expect(validate(0, { ...validForm, title: '', price: '' })).toEqual({
      title: 'title required',
      price: 'valid price required',
    });
  });

  it.each(['', '0', '-100', '12x', '9'.repeat(30)])('rejects invalid price %s', price => {
    expect(validate(0, { ...validForm, price }).price).toBe('valid price required');
  });

  it('requires a photo and enforces the existing maximum of eight', () => {
    expect(validate(1, validForm, '', 0).images).toBe('one image required');
    expect(validate(1, validForm, '', 9).images).toBe('one image required');
    expect(validate(1, validForm, '', 8)).toEqual({});
  });

  it('requires city and neighborhood on the location step', () => {
    expect(validate(2, { ...validForm, city: '', location: '' })).toEqual({
      city: 'city required',
      location: 'neighborhood required',
    });
  });

  it('uses the account phone when no alternate contact phone is entered', () => {
    expect(validate(3, { ...validForm, clientPhone: '' }, '90000000')).toEqual({});
    expect(validate(3, { ...validForm, clientPhone: '' })).toEqual({
      clientPhone: 'phone required',
    });
  });

  it('validates all required information before final submission', () => {
    expect(validate(4, { ...validForm, price: '', clientPhone: '' }, '', 0)).toEqual({
      price: 'valid price required',
      images: 'one image required',
      clientPhone: 'phone required',
    });
  });

  it('leaves optional description and property characteristics outside required validation', () => {
    expect(validate(0)).toEqual({});
  });

  it('resumes only at the first step that has not passed validation', () => {
    expect(getFirstIncompletePublishStep(validForm, '', 0, 8, messages)).toBe(1);
    expect(getFirstIncompletePublishStep({ ...validForm, clientPhone: '' }, '', 1, 8, messages)).toBe(3);
    expect(getFirstIncompletePublishStep(validForm, '90000000', 1, 8, messages)).toBe(4);
  });

  it('blocks direct jumps across any invalid intermediate step', () => {
    expect(getFirstInvalidProgressionStep(0, 4, step => step !== 2)).toBe(2);
    expect(getFirstInvalidProgressionStep(0, 4, () => true)).toBeNull();
    expect(getFirstInvalidProgressionStep(3, 1, () => false)).toBeNull();
  });
});
