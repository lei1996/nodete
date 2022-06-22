const { mock } = require("./mock");
const {
  from,
  delay,
  bufferCount,
  concatMap,
  filter,
  zip,
  max,
  min,
  of,
  share,
  toArray,
  map,
  scan,
  last,
} = require("rxjs");
const Big = require("big.js");

let prev = "";
const obj = {
  prevOpen: new Big(0),
  sum: new Big(0),
};
const source$ = from(mock).pipe(delay(20), share());

const mergeKLine = (interval) => {
  return source$.pipe(
    bufferCount(interval, 1),
    concatMap((items) => {
      const source$ = zip(
        from(items).pipe(max((a, b) => (a.high < b.high ? -1 : 1))),
        from(items).pipe(min((a, b) => (a.low < b.low ? -1 : 1))),
        from(items).pipe(
          scan((a, b) => a + b.vol, 0),
          last()
        )
      ).pipe(share());

      return zip(
        source$.pipe(
          concatMap(([max, min]) =>
            of({
              dir: max.id > min.id ? "up" : "down",
              diff: max.high - min.low,
            })
          )
        ),
        source$.pipe(
          map(([max, min, volume]) => ({
            id: items[0].id,
            open: items[0].open,
            close: items[items.length - 1].close,
            high: max.high,
            low: min.low,
            volume,
          }))
        )
      );
    })
  );
};

const findDir = (interval) => {
  return source$.pipe(
    bufferCount(interval, 1),
    filter((x) => x.length === interval),
    concatMap((items) => {
      return zip(
        from(items).pipe(max((a, b) => (a.high < b.high ? -1 : 1))),
        from(items).pipe(min((a, b) => (a.low < b.low ? -1 : 1)))
      );
    }),
    concatMap(([max, min]) =>
      of({ dir: max.id > min.id ? "up" : "down", diff: max.high - min.low })
    )
  );
};

const findDir1 = (interval) => {
  return source$.pipe(
    bufferCount(interval, interval),
    filter((x) => x.length === interval),
    bufferCount(3, 1),
    filter((x) => x.length === 3),
    concatMap((items) => {
      return from(items).pipe(
        concatMap((item) =>
          zip(
            from(item).pipe(max((a, b) => (a.high < b.high ? -1 : 1))),
            from(item).pipe(min((a, b) => (a.low < b.low ? -1 : 1)))
          )
        ),
        concatMap(([max, min]) =>
          of({ dir: max.id > min.id ? "up" : "down", diff: max.high - min.low })
        ),
        toArray()
      );
    })
  );
};

// findDir(30).subscribe((x) => console.log(x, "30 result ->"));

// findDir(60).subscribe((x) => console.log(x, "60 result ->"));

// findDir(90).subscribe((x) => console.log(x, "90 result ->"));

mergeKLine(5)
  .pipe(
    concatMap(([x1, x2]) => {
      if (prev === "") {
        prev = x1.dir;
      } else if (prev !== x1.dir) {
        if (x1.dir === "up") {
          if (!obj.prevOpen.eq(0)) {
            obj.sum = obj.sum.plus(obj.prevOpen.minus(x2.close));
          }
          obj.prevOpen = new Big(x2.close);
        } else {
          if (!obj.prevOpen.eq(0)) {
            obj.sum = obj.sum.plus(new Big(x2.close).minus(obj.prevOpen));
          }
          obj.prevOpen = new Big(x2.close);
        }
        prev = x1.dir;
      }

      return of(obj.sum.toString());
    })
  )
  .subscribe((x) => console.log(x, "5 result ->"));

// findDir1(30).subscribe((x) => console.log(x, "30 findDir1 ->"));
