/**
 * RADAR — CategoryCreateSheet
 *
 * Reusable bottom-sheet modal for creating a custom category.
 * Extracted from CategoryPicker so both the "+ Categoría" chip and
 * the OCR suggestion CTA can share the same create UI.
 */
import React, { useEffect, useState } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';

import { H2, Icon } from '@/components/ui';
import { CategoryForm } from '@/components/categories/category-form';
import { useCreateCategory } from '@/hooks/use-categories';
import { colors, radii, shadows, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryCreateSheetProps {
  visible: boolean;
  /** Prefill the name field (e.g. OCR suggestion). */
  defaultName?: string;
  onClose: () => void;
  /** Called with the newly created category's id on success. */
  onCreated: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryCreateSheet({
  visible,
  defaultName,
  onClose,
  onCreated,
}: CategoryCreateSheetProps): React.JSX.Element {
  const createMutation = useCreateCategory();
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset server error whenever the sheet becomes visible so stale errors
  // from a previous open session do not show on the next open.
  useEffect(() => {
    if (visible) {
      setServerError(null);
    }
  }, [visible]);

  async function handleCreate(
    values: Parameters<typeof createMutation.mutateAsync>[0],
  ): Promise<void> {
    setServerError(null);
    try {
      const created = await createMutation.mutateAsync(values);
      onClose();
      onCreated(created.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo crear la categoría. Intentá nuevamente.';
      setServerError(message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg[1],
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            padding: spacing[5],
            paddingBottom: spacing[8],
            ...shadows.three,
          }}
        >
          {/* Modal header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing[5],
            }}
          >
            <H2>Nueva categoría</H2>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Icon name="X" size={24} color={colors.fg[2]} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <CategoryForm
            defaultName={defaultName}
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
            errorMessage={serverError}
          />
        </View>
      </View>
    </Modal>
  );
}
