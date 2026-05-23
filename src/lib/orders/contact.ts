export type ContactIdentity =
  | {
      type: "email";
      value: string;
    }
  | {
      type: "phone";
      value: string;
    };

function normalizePhoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("86") && digits.length === 13) {
    return digits.slice(2);
  }

  return digits;
}

function normalizeEmail(email: string): ContactIdentity {
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmedEmail)) {
      throw new Error("邮箱格式不正确");
    }

    return {
      type: "email",
      value: trimmedEmail
    };
  }

  throw new Error("请填写邮箱或手机号");
}

function normalizePhone(phone: string): ContactIdentity {
  const digits = normalizePhoneDigits(phone);
  if (!digits) {
    throw new Error("请填写邮箱或手机号");
  }

  // Normalize to Mainland CN mobile identity: 11 digits, leading 1.
  if (!/^1\d{10}$/u.test(digits)) {
    throw new Error("手机号格式不正确");
  }

  return {
    type: "phone",
    value: digits
  };
}

export function normalizeContactValue(value: string): ContactIdentity {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请填写邮箱或手机号");
  }

  if (trimmed.includes("@")) {
    return normalizeEmail(trimmed);
  }

  return normalizePhone(trimmed);
}

export function normalizeContactIdentity(email: string, phone: string): ContactIdentity {
  const trimmedEmail = email.trim();
  if (trimmedEmail) {
    return normalizeEmail(trimmedEmail);
  }

  return normalizePhone(phone);
}
