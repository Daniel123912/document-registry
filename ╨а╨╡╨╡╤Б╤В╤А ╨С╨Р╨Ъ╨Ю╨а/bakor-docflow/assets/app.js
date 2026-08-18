(function () {
  "use strict";

  var tabsRoots = document.querySelectorAll("[data-bakor-tabs]");

  tabsRoots.forEach(function (root) {
    var buttons = root.querySelectorAll("button[data-tab]");
    var wrap = root.closest(".bakor-wrap");

    if (!wrap) {
      return;
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var tab = button.getAttribute("data-tab");
        var panels = wrap.querySelectorAll("[data-panel]");

        buttons.forEach(function (btn) {
          btn.classList.remove("is-active");
        });

        panels.forEach(function (panel) {
          panel.classList.remove("is-active");
        });

        button.classList.add("is-active");

        var target = wrap.querySelector('[data-panel="' + tab + '"]');
        if (target) {
          target.classList.add("is-active");
        }
      });
    });
  });
})();
