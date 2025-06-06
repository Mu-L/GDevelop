// @flow
import * as React from 'react';
import { Trans, t } from '@lingui/macro';
import { I18n } from '@lingui/react';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import { formatISO, subDays } from 'date-fns';
import { Column, Line } from '../UI/Grid';
import {
  type Game,
  type GameFeaturing,
  type MarketingPlan,
} from '../Utils/GDevelopServices/Game';
import { ColumnStackLayout } from '../UI/Layout';
import Text from '../UI/Text';
import {
  type GameMetrics,
  getGameMetricsFrom,
} from '../Utils/GDevelopServices/Analytics';
import AuthenticatedUserContext from '../Profile/AuthenticatedUserContext';
import PlaceholderError from '../UI/PlaceholderError';
import SelectField from '../UI/SelectField';
import SelectOption from '../UI/SelectOption';
import PlaceholderLoader from '../UI/PlaceholderLoader';
import InfoIcon from '../UI/CustomSvgIcons/CircledInfo';
import { buildChartData, daysShownForYear } from './GameAnalyticsEvaluator';
import {
  BounceRateChart,
  MeanPlayTimeChart,
  PlayersRepartitionPerDurationChart,
  PlayersDurationPerDayChart,
  SessionsChart,
} from './GameAnalyticsCharts';
import MarketingPlanSingleDisplay from '../MarketingPlans/MarketingPlanSingleDisplay';

const chartHeight = 300;

type Props = {|
  game: Game,
  recommendedMarketingPlan?: ?MarketingPlan,
  gameFeaturings?: ?(GameFeaturing[]),
  fetchGameFeaturings?: () => Promise<void>,
|};

export const GameAnalyticsPanel = ({
  game,
  recommendedMarketingPlan,
  gameFeaturings,
  fetchGameFeaturings,
}: Props) => {
  const { getAuthorizationHeader, profile } = React.useContext(
    AuthenticatedUserContext
  );

  const [gameRollingMetrics, setGameMetrics] = React.useState<?(GameMetrics[])>(
    null
  );
  const { yearChartData, monthChartData } = React.useMemo(
    () => buildChartData(gameRollingMetrics),
    [gameRollingMetrics]
  );
  const [dataPeriod, setDataPeriod] = React.useState('month');
  const chartData = dataPeriod === 'year' ? yearChartData : monthChartData;

  const [gameRollingMetricsError, setGameMetricsError] = React.useState<?Error>(
    null
  );
  const [isGameMetricsLoading, setIsGameMetricsLoading] = React.useState(false);

  // TODO In some timezones, it might ask one less or extra day.
  const lastYearIsoDate = formatISO(subDays(new Date(), daysShownForYear), {
    representation: 'date',
  });
  const loadGameMetrics = React.useCallback(
    async () => {
      if (!profile) return;

      const { id } = profile;

      setIsGameMetricsLoading(true);
      setGameMetricsError(null);
      try {
        const gameRollingMetrics = await getGameMetricsFrom(
          getAuthorizationHeader,
          id,
          game.id,
          lastYearIsoDate
        );
        setGameMetrics(gameRollingMetrics);
      } catch (err) {
        console.error(`Unable to load game rolling metrics:`, err);
        setGameMetricsError(err);
      }
      setIsGameMetricsLoading(false);
    },
    [getAuthorizationHeader, profile, game, lastYearIsoDate]
  );

  React.useEffect(
    () => {
      loadGameMetrics();
    },
    [loadGameMetrics]
  );

  if (isGameMetricsLoading) return <PlaceholderLoader />;

  const displaySuggestedMarketingPlan =
    recommendedMarketingPlan && gameFeaturings && fetchGameFeaturings;

  return (
    <I18n>
      {({ i18n }) =>
        gameRollingMetricsError ? (
          <PlaceholderError
            onRetry={() => {
              loadGameMetrics();
            }}
          >
            <Trans>There was an issue getting the game analytics.</Trans>{' '}
            <Trans>Verify your internet connection or try again later.</Trans>
          </PlaceholderError>
        ) : (
          <ColumnStackLayout expand>
            <Line noMargin justifyContent="flex-end">
              <SelectField
                value={dataPeriod}
                onChange={(e, i, period: string) => {
                  setDataPeriod(period);
                }}
                disableUnderline
              >
                <SelectOption key="month" value="month" label={t`Month`} />
                <SelectOption key="year" value="year" label={t`Year`} />
              </SelectField>
            </Line>
            <Grid container spacing={2}>
              <Grid
                item
                xs={12}
                sm={displaySuggestedMarketingPlan ? 7 : 12}
                md={displaySuggestedMarketingPlan ? 8 : 12}
              >
                <Column noMargin alignItems="center" expand>
                  <Text size="block-title" align="center">
                    <Trans>{chartData.overview.playersCount} sessions</Trans>
                    <Tooltip
                      style={{ verticalAlign: 'bottom' }}
                      title={
                        <Text>
                          <Trans>
                            Number of people who launched the game. Viewers are
                            considered players when they stayed at least 60
                            seconds including loading screens.
                          </Trans>
                        </Text>
                      }
                    >
                      <InfoIcon />
                    </Tooltip>
                  </Text>
                  <SessionsChart
                    chartData={chartData}
                    height={chartHeight}
                    i18n={i18n}
                  />
                </Column>
              </Grid>
              {recommendedMarketingPlan &&
                gameFeaturings &&
                fetchGameFeaturings && (
                  <Grid item xs={12} sm={5} md={4}>
                    <MarketingPlanSingleDisplay
                      fetchGameFeaturings={fetchGameFeaturings}
                      gameFeaturings={gameFeaturings}
                      marketingPlan={recommendedMarketingPlan}
                      game={game}
                    />
                  </Grid>
                )}
              <Grid item xs={12} sm={6}>
                <Column noMargin alignItems="center" expand>
                  <Text size="block-title" align="center">
                    <Trans>
                      {Math.round(chartData.overview.bounceRatePercent)}% bounce
                      rate
                    </Trans>
                    <Tooltip
                      style={{ verticalAlign: 'bottom' }}
                      title={
                        <Text>
                          <Trans>
                            Percentage of people who leave before 60 seconds
                            including loading screens.
                          </Trans>
                        </Text>
                      }
                    >
                      <InfoIcon />
                    </Tooltip>
                  </Text>
                  <BounceRateChart
                    chartData={chartData}
                    height={chartHeight}
                    i18n={i18n}
                  />
                </Column>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Column expand noMargin alignItems="center">
                  <Text size="block-title" align="center">
                    <Trans>
                      {Math.round(
                        chartData.overview.meanPlayedDurationInMinutes
                      )}{' '}
                      minutes per player
                    </Trans>
                    <Tooltip
                      style={{ verticalAlign: 'bottom' }}
                      title={
                        <Text>
                          <Trans>
                            Is the average time a player spends in the game.
                          </Trans>
                        </Text>
                      }
                    >
                      <InfoIcon />
                    </Tooltip>
                  </Text>
                  <MeanPlayTimeChart
                    chartData={chartData}
                    height={chartHeight}
                    i18n={i18n}
                  />
                </Column>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Column expand noMargin alignItems="center">
                  <Text size="block-title" align="center">
                    <Trans>
                      {
                        chartData.overview.greaterDurationPlayerSurface
                          .playersCount
                      }{' '}
                      players with more than{' '}
                      {
                        chartData.overview.greaterDurationPlayerSurface
                          .durationInMinutes
                      }{' '}
                      minutes
                    </Trans>
                    <Tooltip
                      style={{ verticalAlign: 'bottom' }}
                      title={
                        <Text>
                          <Trans>
                            Average of players still active after 15 minutes.
                            This graph shows how long players stay in the game
                            after X minutes. It helps to see if the players quit
                            quickly or keep playing for a while.
                          </Trans>
                        </Text>
                      }
                    >
                      <InfoIcon />
                    </Tooltip>
                  </Text>
                  <PlayersRepartitionPerDurationChart
                    chartData={chartData}
                    height={chartHeight}
                    i18n={i18n}
                  />
                </Column>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Column expand noMargin alignItems="center">
                  <Text size="block-title" align="center">
                    <Trans>
                      {Math.round(
                        chartData.overview.nearestToMedianDuration
                          .playersPercent
                      )}
                      % of players with more than{' '}
                      {
                        chartData.overview.nearestToMedianDuration
                          .durationInMinutes
                      }{' '}
                      minutes
                    </Trans>
                    <Tooltip
                      style={{ verticalAlign: 'bottom' }}
                      title={
                        <Text>
                          <Trans>
                            Shows how long players stay in the game over time.
                            The percentages are showing people playing for more
                            than 3, 5, 10, and 15 minutes based on the best day.
                            A higher value means better player retention on the
                            day. This helps you understand when players are most
                            engaged — and when they drop off quickly.
                          </Trans>
                        </Text>
                      }
                    >
                      <InfoIcon />
                    </Tooltip>
                  </Text>
                  <PlayersDurationPerDayChart
                    chartData={chartData}
                    height={chartHeight}
                    i18n={i18n}
                  />
                </Column>
              </Grid>
            </Grid>
          </ColumnStackLayout>
        )
      }
    </I18n>
  );
};
