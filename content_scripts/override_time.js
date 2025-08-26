function injectScript(code) {
  const script = document.createElement('script');
  script.textContent = code;
  document.documentElement.prepend(script);
  script.remove();
}

(async function() {
  const hostname = window.location.hostname;
  console.log("Hostname: " + hostname);

  const settings = await chrome.storage.sync.get("site_time_zones");
  console.log(settings);
  const timeZone = settings.site_time_zones?.[hostname];

  if (timeZone) {
    console.log("Time zone found for this site: " + timeZone);
    injectScript(`(${overrideTimeZone.toString()})(${JSON.stringify(timeZone)});`);
  } else {
    console.log("No time zone found for this site: " + timeZone);
  }
})();

function overrideTimeZone(tz) {
  // Override Intl
  const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  Intl.DateTimeFormat.prototype.resolvedOptions = function () {
    const options = origResolvedOptions.call(this);
    options.timeZone = tz;
    return options;
  };

  // Override Date functions
  const realDate = Date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parseDateParts = (date) => {
    const parts = formatter.formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return new realDate(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
    );
  };

  // This reconstruction from stringified parts loses sub-second precision and can cause problems
  // when something like Temporal compares the reconstructed date with the underlying system time
  //
  // Date = new Proxy(realDate, {
  //   construct(target, args) {
  //     const date = new target(...args);
  //     return parseDateParts(date);
  //   },
  //   apply(target, thisArg, args) {
  //     const date = target(...args);
  //     return date;
  //   },
  // });

  // Save a reference to the real Intl.DateTimeFormat
  const RealDateTimeFormat = Intl.DateTimeFormat;

  // Override the constructor
  Intl.DateTimeFormat = new Proxy(RealDateTimeFormat, {
    construct(target, args) {
      const [locales, options = {}] = args;

      // Force override timeZone unless explicitly set
      const overriddenOptions = {
        ...options,
        timeZone: options.timeZone || tz,
      };

      return new target(locales, overriddenOptions);
    },

    apply(target, thisArg, args) {
      const [locales, options = {}] = args;

      const overriddenOptions = {
        ...options,
        timeZone: options.timeZone || tz,
      };

      return target.call(thisArg, locales, overriddenOptions);
    }
  });

  // Save real methods
  const realToLocaleString = Date.prototype.toLocaleString;
  const realToLocaleDateString = Date.prototype.toLocaleDateString;
  const realToLocaleTimeString = Date.prototype.toLocaleTimeString;

  // Override to inject timeZone if not present
  Date.prototype.toLocaleString = function(locales, options = {}) {
    return realToLocaleString.call(this, locales, {
      ...options,
      timeZone: options.timeZone || tz
    });
  };

  Date.prototype.toLocaleDateString = function(locales, options = {}) {
    return realToLocaleDateString.call(this, locales, {
      ...options,
      timeZone: options.timeZone || tz
    });
  };

  Date.prototype.toLocaleTimeString = function(locales, options = {}) {
    return realToLocaleTimeString.call(this, locales, {
      ...options,
      timeZone: options.timeZone || tz
    });
  };

  // Save real methods
  const realGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  const realToString = Date.prototype.toString;
  const realToTimeString = Date.prototype.toTimeString;

  // Calculate fake offset once (in minutes)
  const fakeOffset = (() => {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const parts = dtf.formatToParts(new Date());
    const zonePart = parts.find(p => p.type === "timeZoneName");
    // Parse something like "GMT-7"
    const match = zonePart?.value.match(/GMT([+-]\d+)/);
    if (match) {
      return -parseInt(match[1], 10) * 60; // JS offset is opposite sign
    }
    return 0;
  })();

  // Override getTimezoneOffset
  Date.prototype.getTimezoneOffset = function () {
    return fakeOffset;
  };

  // Override toString and toTimeString to inject correct GMT offset
  Date.prototype.toString = function () {
    const date = new realDate(this.getTime());
    // Use Intl to produce correct local string including TZ
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  };

  Date.prototype.toTimeString = function () {
    const date = new realDate(this.getTime());
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  };

}
