/**
 * AiInsightsCard — displays AI / heuristic recommendations on the Insights screen.
 *
 * Behaviour:
 *  - `loading` → shows a centred Loader inside the card.
 *  - `insights.length === 0` and not loading → returns null (card is hidden).
 *  - Otherwise renders each Insight with a kind-specific icon/color row.
 *
 * Kind → icon/color mapping:
 *  warning  → amber  TriangleAlert
 *  positive → green  TrendingUp
 *  tip      → brand  Lightbulb
 *  neutral  → muted  Info
 */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Loader, Text } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import type { Insight, InsightKind } from '@/lib/insights/types';
import { colors, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiInsightsCardProps {
  insights: Insight[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Kind → visual config
// ---------------------------------------------------------------------------

interface KindStyle {
  iconName: IconName;
  color: string;
}

const KIND_STYLES: Record<InsightKind, KindStyle> = {
  warning: { iconName: 'TriangleAlert', color: colors.amber[500] },
  positive: { iconName: 'TrendingUp', color: colors.money.in },
  tip: { iconName: 'Lightbulb', color: colors.brand[300] },
  neutral: { iconName: 'Info', color: colors.fg[3] },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiInsightsCard({
  insights,
  loading = false,
}: AiInsightsCardProps): React.JSX.Element | null {
  // Card is hidden when there are no insights and we are not loading
  if (!loading && insights.length === 0) {
    return null;
  }

  return (
    <Card variant="raised" padding={4}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          marginBottom: spacing[3],
        }}
      >
        <Icon name="Sparkles" size={16} color={colors.brand[300]} strokeWidth={1.5} />
        <Text
          variant="bodySm"
          color={colors.fg[1]}
          style={{ fontFamily: typography.family.semibold }}
        >
          Recomendaciones
        </Text>
      </View>

      {/* Loading state */}
      {loading && (
        <View style={{ alignItems: 'center', paddingVertical: spacing[4] }}>
          <Loader size={20} color={colors.fg[3]} />
        </View>
      )}

      {/* Insight rows */}
      {!loading &&
        insights.map((insight, index) => {
          const kindStyle = KIND_STYLES[insight.kind];
          return (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: spacing[3],
                paddingVertical: spacing[2],
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.line[1],
              }}
              accessibilityLabel={`${insight.kind}: ${insight.title}`}
            >
              <View style={{ paddingTop: 2 }} testID={`insight-icon-${insight.kind}`}>
                <Icon
                  name={kindStyle.iconName}
                  size={16}
                  color={kindStyle.color}
                  strokeWidth={1.5}
                />
              </View>

              <View style={{ flex: 1, gap: spacing[1] }}>
                <Text
                  variant="bodySm"
                  color={colors.fg[1]}
                  style={{ fontFamily: typography.family.semibold }}
                >
                  {insight.title}
                </Text>

                <Text
                  variant="caption"
                  color={colors.fg[2]}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {insight.body}
                </Text>

                {insight.cta != null && (
                  <Pressable
                    onPress={() => {
                      // CTA navigation is wired by the parent screen when route is available.
                      // No-op default keeps the component self-contained.
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={insight.cta.label}
                    style={{ marginTop: spacing[1] }}
                  >
                    <Text
                      variant="caption"
                      color={colors.brand[300]}
                      style={{ fontFamily: typography.family.semibold }}
                    >
                      {insight.cta.label}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
    </Card>
  );
}
