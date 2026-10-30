export type PublishField = 'title' | 'price' | 'images' | 'city' | 'location' | 'clientPhone';

export type PublishFormValues = {
  title: string;
  price: string;
  city: string;
  location: string;
  clientPhone: string;
};

export type PublishValidationErrors = Partial<Record<PublishField, string>>;

export const getPublishStepErrors = (
  step: number,
  form: PublishFormValues,
  accountPhone: string,
  imageCount: number,
  maxImages: number,
  messages: Record<PublishField, string>,
): PublishValidationErrors => {
  const errors: PublishValidationErrors = {};
  const validateAll = step === 4;

  if (validateAll || step === 0) {
    if (!form.title.trim()) errors.title = messages.title;
    const price = Number(form.price);
    if (!/^[0-9]+$/.test(form.price.trim()) || !Number.isSafeInteger(price) || price <= 0) {
      errors.price = messages.price;
    }
  }

  if (validateAll || step === 1) {
    if (imageCount < 1) errors.images = messages.images;
    else if (imageCount > maxImages) errors.images = messages.images;
  }

  if (validateAll || step === 2) {
    if (!form.city.trim()) errors.city = messages.city;
    if (!form.location.trim()) errors.location = messages.location;
  }

  if (validateAll || step === 3) {
    if (!(form.clientPhone.trim() || accountPhone.trim())) {
      errors.clientPhone = messages.clientPhone;
    }
  }

  return errors;
};

export const getFirstIncompletePublishStep = (
  form: PublishFormValues,
  accountPhone: string,
  imageCount: number,
  maxImages: number,
  messages: Record<PublishField, string>,
): number => {
  for (let step = 0; step < 4; step += 1) {
    if (Object.keys(getPublishStepErrors(step, form, accountPhone, imageCount, maxImages, messages)).length) {
      return step;
    }
  }
  return 4;
};

export const getFirstInvalidProgressionStep = (
  currentStep: number,
  targetStep: number,
  isStepValid: (step: number) => boolean,
): number | null => {
  for (let step = currentStep; step < targetStep; step += 1) {
    if (!isStepValid(step)) return step;
  }
  return null;
};
