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

export function normalizeContactIdentity(email: string, phone: string): ContactIdentity {
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

  const digits = normalizePhoneDigits(phone);
  if (!digits) {
    throw new Error("请填写邮箱或手机号");
  }

  if (digits.length < 11) {
    throw new Error("手机号格式不正确");
  }

  return {
    type: "phone",
    value: digits
  };
}
