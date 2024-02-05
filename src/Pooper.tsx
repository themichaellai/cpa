import { useCallback, useMemo } from 'react';
import { LocalDate } from '@js-joda/core';
import { Button, Card, Flex, Switch } from '@radix-ui/themes';

import { useDay, Day, Poop } from './store';
import { formatTimeForDisplay, now } from './time';

const Pooper: React.FC<{
  date: LocalDate;
}> = ({ date }) => {
  const [day, setDay] = useDay(date);

  const poops = useMemo(() => day.map((d) => d.poops).orDefault([]), [day]);
  const addPoop = useCallback(() => {
    day
      .map((d): Day => {
        return {
          ...d,
          poops: [
            ...d.poops,
            {
              time: now(),
              run: null,
            },
          ],
        };
      })
      .ifJust((d) => {
        setDay(d);
      });
  }, [day, setDay]);

  const poopEls = useMemo(
    () =>
      poops.map((poop, idx) => {
        const toggleRun = (val: boolean) => {
          day
            .map((d): Day => {
              const newPoop: Poop = {
                ...poop,
                run: !val
                  ? null
                  : {
                      timeIntoRunMinutes: 0,
                    },
              };
              return {
                ...d,
                poops: [
                  ...d.poops.slice(0, idx),
                  newPoop,
                  ...d.poops.slice(idx + 1),
                ],
              };
            })
            .ifJust((d) => {
              setDay(d);
            });
        };

        return (
          <Card key={`${day}-${idx}`}>
            <Flex align="center" gap="1" className="mb-2">
              <div className="w-1/4">Time</div>
              <div className="flex-1 text-right">
                {formatTimeForDisplay(poop.time).orDefault('error')}
              </div>
            </Flex>
            <Flex align="center" gap="1">
              <div className="w-1/4">On run</div>
              <div className="flex-1 text-right">
                <Switch
                  checked={poop.run != null}
                  onCheckedChange={toggleRun}
                  variant="soft"
                  size="3"
                />
              </div>
            </Flex>
          </Card>
        );
      }),
    [poops, setDay, day],
  );

  return (
    <>
      <div className="mb-2">{poopEls}</div>
      <Button onClick={addPoop} variant="soft">
        Add poop
      </Button>
    </>
  );
};

export default Pooper;
