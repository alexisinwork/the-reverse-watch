/* The Reserve block for the WordPress editor (no build step needed). */
(function (wp) {
  "use strict";
  var el = wp.element.createElement;
  var __ = wp.i18n.__;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var useBlockProps = wp.blockEditor.useBlockProps;
  var PanelBody = wp.components.PanelBody;
  var SelectControl = wp.components.SelectControl;
  var TextControl = wp.components.TextControl;
  var features = window.theReserveFeatures || { quiz: "Watch diagnostic" };

  wp.blocks.registerBlockType("the-reserve/widget", {
    apiVersion: 2,
    title: "The Reserve",
    description: __("A watch finder from The Reserve.", "the-reserve"),
    icon: "clock",
    category: "widgets",
    attributes: {
      feature: { type: "string", default: "quiz" },
      scheme: { type: "string", default: "" },
      accent: { type: "string", default: "" },
      params: { type: "string", default: "" },
    },
    edit: function (props) {
      var a = props.attributes;
      var set = function (name) {
        return function (value) {
          var patch = {};
          patch[name] = value;
          props.setAttributes(patch);
        };
      };
      return el(
        "div",
        useBlockProps({
          style: {
            padding: "24px",
            border: "1px dashed #8a8a8a",
            textAlign: "center",
          },
        }),
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Widget", "the-reserve") },
            el(SelectControl, {
              label: __("Feature", "the-reserve"),
              value: a.feature,
              options: Object.keys(features).map(function (value) {
                return { value: value, label: features[value] };
              }),
              onChange: set("feature"),
            }),
            el(SelectControl, {
              label: __("Look", "the-reserve"),
              value: a.scheme,
              options: [
                { value: "", label: __("Site setting", "the-reserve") },
                { value: "dark", label: __("Dark", "the-reserve") },
                { value: "light", label: __("Light", "the-reserve") },
              ],
              onChange: set("scheme"),
            }),
            el(TextControl, {
              label: __("Accent colour (#hex)", "the-reserve"),
              value: a.accent,
              onChange: set("accent"),
            }),
            el(TextControl, {
              label: __("Start with a search (optional)", "the-reserve"),
              help: __("e.g. type=actor&q=Daniel Craig", "the-reserve"),
              value: a.params,
              onChange: set("params"),
            }),
          ),
        ),
        el("strong", null, "The Reserve"),
        el("p", null, features[a.feature] || a.feature),
        el(
          "p",
          { style: { fontSize: "12px", opacity: 0.7 } },
          __("The widget appears on the published page.", "the-reserve"),
        ),
      );
    },
    save: function () {
      return null;
    },
  });
})(window.wp);
