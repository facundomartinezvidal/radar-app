/**
 * RADAR — CategorySelectorSheet
 *
 * Searchable bottom-sheet for selecting a category.
 * Allows creating custom categories inline.
 * Edit / delete are handled by the dedicated management screen
 * (reachable via the "Gestionar categorías" link at the bottom).
 * System categories (user_id === null) are read-only in the selector.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { H2, H3, Icon, Input, Text } from '@/components/ui';
import { CategoryForm } from '@/components/categories/category-form';
import { useCreateCategory } from '@/hooks/use-categories';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { IconName } from '@/components/ui/icon';
import { normalizeName } from '@/lib/ocr';
import { colors, radii, shadows, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategorySelectorSheetProps {
  visible: boolean;
  categories: CategoryRow[];
  value: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
}

type SheetMode = 'list' | 'create';

// ---------------------------------------------------------------------------
// Sub-component: CategoryTile
// ---------------------------------------------------------------------------

interface CategoryTileProps {
  cat: CategoryRow;
  selected: boolean;
  onSelect: () => void;
}

function CategoryTile({ cat, selected, onSelect }: CategoryTileProps): React.JSX.Element {
  return (
    <View style={{ width: '33.33%', padding: spacing[1] }}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={`Categoría ${cat.name}`}
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          borderRadius: radii.md,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? cat.color : colors.line[2],
          backgroundColor: selected ? `${cat.color}1A` : pressed ? colors.bg[3] : colors.bg[2],
          padding: spacing[3],
          alignItems: 'center',
          minHeight: 72,
          justifyContent: 'center',
          gap: spacing[2],
        })}
      >
        <Icon name={cat.icon as IconName} size={20} color={cat.color} strokeWidth={1.5} />
        <Text
          variant="caption"
          color={selected ? colors.fg[1] : colors.fg[2]}
          style={{ fontWeight: '600', textAlign: 'center' }}
          numberOfLines={2}
        >
          {cat.name}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CategorySelectorSheet({
  visible,
  categories,
  value,
  onClose,
  onSelect,
}: CategorySelectorSheetProps): React.JSX.Element {
  const [mode, setMode] = useState<SheetMode>('list');
  const [query, setQuery] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const createMutation = useCreateCategory();

  // Reset state each time the sheet opens
  function handleOpen(): void {
    setMode('list');
    setQuery('');
    setServerError(null);
  }

  function handleClose(): void {
    setMode('list');
    setQuery('');
    setServerError(null);
    onClose();
  }

  // Filter categories by search query
  const normalizedQuery = normalizeName(query);
  const filtered =
    normalizedQuery.length === 0
      ? categories
      : categories.filter((cat) => normalizeName(cat.name).includes(normalizedQuery));

  // -------------------------------------------------------------------------
  // Create handler
  // -------------------------------------------------------------------------

  async function handleCreate(
    values: Parameters<typeof createMutation.mutateAsync>[0],
  ): Promise<void> {
    setServerError(null);
    try {
      const created = await createMutation.mutateAsync(values);
      onSelect(created.id);
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo crear la categoría. Intentá nuevamente.';
      setServerError(message);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      onShow={handleOpen}
    >
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
            maxHeight: '85%',
            ...shadows.three,
          }}
        >
          {/* ---------------------------------------------------------------- */}
          {/* LIST MODE                                                        */}
          {/* ---------------------------------------------------------------- */}
          {mode === 'list' && (
            <>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[5],
                  paddingTop: spacing[5],
                  paddingBottom: spacing[3],
                }}
              >
                <H2>Elegir categoría</H2>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Icon name="X" size={24} color={colors.fg[2]} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[3] }}>
                <Input
                  placeholder="Buscar categoría"
                  value={query}
                  onChangeText={setQuery}
                  leftIcon={<Icon name="Search" size={16} color={colors.fg[3]} strokeWidth={1.5} />}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
              </View>

              {/* Category list */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing[4],
                  paddingBottom: spacing[4],
                }}
              >
                {/* Sin categoría option */}
                <Pressable
                  onPress={() => {
                    onSelect(null);
                    handleClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Sin categoría"
                  accessibilityState={{ selected: value === null }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    paddingVertical: spacing[3],
                    paddingHorizontal: spacing[4],
                    borderRadius: radii.md,
                    borderWidth: value === null ? 2 : 1,
                    borderColor: value === null ? colors.brand[400] : colors.line[2],
                    backgroundColor:
                      value === null
                        ? `${colors.brand[400]}1A`
                        : pressed
                          ? colors.bg[3]
                          : colors.bg[2],
                    marginBottom: spacing[3],
                    minHeight: 44,
                  })}
                >
                  <Icon name="Ban" size={20} color={colors.fg[3]} strokeWidth={1.5} />
                  <Text
                    variant="bodySm"
                    color={value === null ? colors.fg[1] : colors.fg[2]}
                    style={{ fontWeight: '600' }}
                  >
                    Sin categoría
                  </Text>
                </Pressable>

                {/* Category grid */}
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing[1] }}
                >
                  {filtered.map((cat) => (
                    <CategoryTile
                      key={cat.id}
                      cat={cat}
                      selected={value === cat.id}
                      onSelect={() => {
                        onSelect(cat.id);
                        handleClose();
                      }}
                    />
                  ))}

                  {/* Nueva categoría tile */}
                  <View style={{ width: '33.33%', padding: spacing[1] }}>
                    <Pressable
                      onPress={() => {
                        setServerError(null);
                        setMode('create');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Nueva categoría"
                      style={({ pressed }) => ({
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.line[3],
                        backgroundColor: pressed ? colors.bg[3] : colors.bg[2],
                        padding: spacing[3],
                        alignItems: 'center',
                        minHeight: 72,
                        justifyContent: 'center',
                        gap: spacing[2],
                      })}
                    >
                      <Icon name="Plus" size={20} color={colors.fg[3]} strokeWidth={1.5} />
                      <Text
                        variant="caption"
                        color={colors.fg[3]}
                        style={{ fontWeight: '600', textAlign: 'center' }}
                      >
                        Nueva categoría
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Empty state when search returns nothing */}
                {filtered.length === 0 && normalizedQuery.length > 0 && (
                  <Text
                    variant="bodySm"
                    color={colors.fg[3]}
                    style={{ textAlign: 'center', paddingVertical: spacing[5] }}
                  >
                    No hay categorías que coincidan con la búsqueda.
                  </Text>
                )}

                {/* Gestionar categorías link */}
                <TouchableOpacity
                  onPress={() => {
                    handleClose();
                    router.push('/(protected)/profile/categories');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Gestionar categorías"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing[2],
                    paddingVertical: spacing[4],
                    marginTop: spacing[2],
                  }}
                >
                  <Icon name="Settings" size={16} color={colors.fg[3]} strokeWidth={1.5} />
                  <Text variant="bodySm" color={colors.fg[3]} style={{ fontWeight: '500' }}>
                    Gestionar categorías
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* CREATE MODE                                                      */}
          {/* ---------------------------------------------------------------- */}
          {mode === 'create' && (
            <>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                  paddingHorizontal: spacing[5],
                  paddingTop: spacing[5],
                  paddingBottom: spacing[3],
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setMode('list');
                    setServerError(null);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Volver"
                >
                  <Icon name="ArrowLeft" size={24} color={colors.fg[2]} strokeWidth={1.5} />
                </TouchableOpacity>
                <H3>Nueva categoría</H3>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing[5],
                  paddingBottom: spacing[8],
                }}
              >
                <CategoryForm
                  onSubmit={handleCreate}
                  isSubmitting={createMutation.isPending}
                  errorMessage={serverError}
                />
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
