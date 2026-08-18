(function ($) {
  "use strict";

  var frame;

  $(document).on("click", "#bakor_pick_file", function (event) {
    event.preventDefault();

    if (frame) {
      frame.open();
      return;
    }

    frame = wp.media({
      title: "Select document file",
      button: { text: "Use this file" },
      multiple: false
    });

    frame.on("select", function () {
      var attachment = frame.state().get("selection").first().toJSON();
      $("#bakor_attachment_id").val(attachment.id);
      $("#bakor_file_label").text(attachment.filename || "File selected");
    });

    frame.open();
  });

  $(document).on("click", "#bakor_clear_file", function (event) {
    event.preventDefault();
    $("#bakor_attachment_id").val("");
    $("#bakor_file_label").text("No file selected");
  });
})(jQuery);
