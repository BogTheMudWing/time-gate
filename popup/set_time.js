/**
 * Listen for clicks on the buttons, and send the appropriate message to
 * the content script in the page.
 */
function listenForClicks() {
  document.addEventListener("click", (e) => {
    /**
     * Set time zone override for this site.
     */
    function setTime() {
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log(tabs);
        if (!tabs.length) return;

        const url = new URL(tabs[0].url);
        const hostname = url.hostname;

        chrome.storage.sync.get("site_time_zones", (result) => {
          // Make sure we have an object to work with
          let settings = result.site_time_zones || {};

          // Set the time zone for the current URL
          const newTimeZone = document.getElementById("timezone").value;
          if (newTimeZone) settings[hostname] = document.getElementById("timezone").value;
          else {
            return;
          }

          // Save back to storage
          chrome.storage.sync.set({ site_time_zones: settings }, () => {
            console.log("Time zone updated for", hostname);
            document.getElementById("reload-notice").removeAttribute("class");
          });
        });
      });
    }

    /**
     * Remove the time zone override for this site.
     */
    function reset() {
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) return;

        const url = new URL(tabs[0].url);
        const hostname = url.hostname;

        chrome.storage.sync.get("site_time_zones", (result) => {
          // Make sure we have an object to work with
          let settings = result.site_time_zones || {};

          // Set the time zone for the current URL
          settings[hostname] = undefined;

          // Save back to storage
          chrome.storage.sync.set({ site_time_zones: settings }, () => {
            console.log("Time zone updated for", hostname);
            document.getElementById("reload-notice").removeAttribute("class");
          });
        });
      });
    }

    /**
     * Just log the error to the console.
     */
    function reportError(error) {
      console.error(`Could not set time zone: ${error}`);
    }

    /**
     * Get the active tab,
     * then call "setTime()" or "reset()" as appropriate.
     */
    if (e.target.tagName !== "BUTTON" || !e.target.closest("#popup-content")) {
      // Ignore when click is not on a button within <div id="popup-content">.
      return;
    }
    if (e.target.type === "reset") {
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(reset)
        .catch(reportError);
    } else {
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(setTime)
        .catch(reportError);
    }
  });
}

/**
 * There was an error executing the script.
 * Display the popup's error message, and hide the normal UI.
 */
function reportExecuteScriptError(error) {
  document.querySelector("#popup-content").classList.add("hidden");
  document.querySelector("#error-content").classList.remove("hidden");
  console.error(
    `Failed to execute override time content script: ${error.message}`
  );
}

/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */
listenForClicks();
// browser.tabs
//   .executeScript({ file: "/content_scripts/override_time.js" })
//   .then(listenForClicks)
//   .catch(reportExecuteScriptError);
