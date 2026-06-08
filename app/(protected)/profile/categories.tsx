/**
 * RADAR — Categorías screen (Perfil stack)
 *
 * Lists the user's own (custom) categories with edit and delete actions.
 * System categories (user_id === null) are excluded.
 */
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, H2, Icon, Loader, Text } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { useDeleteCategory } from '@/hooks/use-categories';
import { useCategories } from '@/hooks/use-expenses';
import { colors, radii, spacing } from '@/lib/theme';

export default function CategoriesScreen(): React.JSX.Element {
  const { data: allCategories, isLoading } = useCategories();
  const deleteMutation = useDeleteCategory();

  const customCategories = (allCategories ?? []).filter((c) => c.user_id !== null);

  function handleDelete(id: string, name: string): void {
    Alert.alert('Eliminar categoría', '¿Confirmás que querés eliminar esta categoría?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void deleteMutation.mutateAsync(id).catch(() => {
            Alert.alert('Error', 'No se pudo eliminar la categoría. Intentá nuevamente.');
          });
        },
      },
    ]);
    // name is used only for future display; kept for clarity
    void name;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={12}
          style={styles.backButton}
        >
          <Icon name="ChevronLeft" size={24} color={colors.fg[1]} strokeWidth={1.5} />
        </Pressable>
        <H2 style={styles.headerTitle}>Categorías</H2>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.center}>
            <Loader size={24} color={colors.fg[3]} />
          </View>
        ) : customCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Body color={colors.fg[3]}>No hay categorías.</Body>
          </View>
        ) : (
          <Card variant="base" style={styles.listCard}>
            {customCategories.map((cat, index) => (
              <View key={cat.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.listRow} testID={`category-row-${cat.id}`}>
                  {/* Category chip / left side */}
                  <View style={styles.categoryChip}>
                    <View
                      style={[
                        styles.chipInner,
                        {
                          borderColor: cat.color,
                          backgroundColor: `${cat.color}1A`,
                        },
                      ]}
                    >
                      <Icon
                        name={cat.icon as IconName}
                        size={16}
                        color={cat.color}
                        strokeWidth={1.5}
                      />
                      <Text variant="bodySm" color={colors.fg[1]} style={{ fontWeight: '600' }}>
                        {cat.name}
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/(protected)/profile/category-form?id=${cat.id}` as Parameters<
                            typeof router.push
                          >[0],
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${cat.name}`}
                      hitSlop={8}
                      style={styles.actionButton}
                      testID={`edit-category-${cat.id}`}
                    >
                      <Icon name="Pencil" size={18} color={colors.fg[3]} strokeWidth={1.5} />
                    </Pressable>

                    <Pressable
                      onPress={() => handleDelete(cat.id, cat.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar ${cat.name}`}
                      hitSlop={8}
                      style={styles.actionButton}
                      testID={`delete-category-${cat.id}`}
                    >
                      <Icon name="Trash2" size={18} color={colors.money.out} strokeWidth={1.5} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Add button */}
        <View style={styles.addButtonContainer}>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onPress={() => router.push('/(protected)/profile/category-form')}
            accessibilityLabel="Agregar categoría"
          >
            Agregar categoría
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  backButton: {
    padding: spacing[1],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24 + spacing[1] * 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing[7],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[7],
  },
  listCard: {
    padding: 0,
    borderRadius: radii.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line[1],
    marginHorizontal: spacing[4],
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
  },
  categoryChip: {
    flex: 1,
    marginRight: spacing[3],
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  actionButton: {
    padding: spacing[2],
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonContainer: {
    marginTop: spacing[2],
  },
});
