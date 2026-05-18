import { nameSchema, profileUpdateSchema } from '../profile';

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  const issue = result.error.issues[0];
  if (!issue) throw new Error('Expected at least one validation issue');
  return issue.message;
}

describe('nameSchema', () => {
  describe('ACCEPT cases', () => {
    it('accepts a simple name', () => {
      const result = nameSchema.safeParse('Facundo');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('Facundo');
    });

    it('accepts accented name with space', () => {
      const result = nameSchema.safeParse('María José');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('María José');
    });

    it('accepts name with ñ', () => {
      const result = nameSchema.safeParse('Núñez');
      expect(result.success).toBe(true);
    });

    it('accepts name with hyphen', () => {
      const result = nameSchema.safeParse('Martinez-Vidal');
      expect(result.success).toBe(true);
    });

    it('accepts name with apostrophe', () => {
      const result = nameSchema.safeParse("O'Brien");
      expect(result.success).toBe(true);
    });

    it('trims whitespace and succeeds', () => {
      const result = nameSchema.safeParse('  Facundo  ');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('Facundo');
    });

    it('accepts exactly 2 characters (lower bound)', () => {
      const result = nameSchema.safeParse('AB');
      expect(result.success).toBe(true);
    });

    it('accepts exactly 40 characters (upper bound)', () => {
      const result = nameSchema.safeParse('a'.repeat(40));
      expect(result.success).toBe(true);
    });
  });

  describe('REJECT cases', () => {
    it('rejects empty string', () => {
      const result = nameSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Mínimo 2 caracteres.');
    });

    it('rejects string of only spaces (post-trim empty)', () => {
      const result = nameSchema.safeParse('   ');
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Mínimo 2 caracteres.');
    });

    it('rejects single character', () => {
      const result = nameSchema.safeParse('F');
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Mínimo 2 caracteres.');
    });

    it('rejects 41 characters (exceeds upper bound)', () => {
      const result = nameSchema.safeParse('a'.repeat(41));
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Máximo 40 caracteres.');
    });

    it('rejects name with digit', () => {
      const result = nameSchema.safeParse('Facundo1');
      expect(result.success).toBe(false);
      if (!result.success)
        expect(firstIssue(result)).toBe('Solo letras, espacios, guiones o apóstrofes.');
    });

    it('rejects name with special symbol', () => {
      const result = nameSchema.safeParse('Facundo!');
      expect(result.success).toBe(false);
      if (!result.success)
        expect(firstIssue(result)).toBe('Solo letras, espacios, guiones o apóstrofes.');
    });

    it('rejects name with emoji', () => {
      const result = nameSchema.safeParse('Facundo😀');
      expect(result.success).toBe(false);
      if (!result.success)
        expect(firstIssue(result)).toBe('Solo letras, espacios, guiones o apóstrofes.');
    });

    it('rejects name with underscore', () => {
      const result = nameSchema.safeParse('Facu_ndo');
      expect(result.success).toBe(false);
      if (!result.success)
        expect(firstIssue(result)).toBe('Solo letras, espacios, guiones o apóstrofes.');
    });

    it('rejects non-string input', () => {
      const result = nameSchema.safeParse(123);
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre válido.');
    });
  });
});

describe('profileUpdateSchema', () => {
  it('accepts valid firstName and lastName', () => {
    const result = profileUpdateSchema.safeParse({
      firstName: 'Facundo',
      lastName: 'Martinez Vidal',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('Facundo');
      expect(result.data.lastName).toBe('Martinez Vidal');
    }
  });

  it('fails when lastName is missing', () => {
    const result = profileUpdateSchema.safeParse({ firstName: 'Facundo' });
    expect(result.success).toBe(false);
  });

  it('fails when both fields are empty strings', () => {
    const result = profileUpdateSchema.safeParse({ firstName: '', lastName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('firstName');
      expect(paths).toContain('lastName');
    }
  });
});
