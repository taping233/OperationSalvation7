// Focused CSS correctness and advisory typography checks, not an aesthetic score.
export default {
  rules: {
    'color-no-invalid-hex': true,
    'property-no-unknown': true,
    'unit-no-unknown': true,
    'custom-property-no-missing-var-function': true,
    'declaration-block-no-duplicate-properties': [true, { ignore: ['consecutive-duplicates-with-different-values'] }],
  },
  overrides: [{
    files: ['game/css/{bag-design-system,container-store,card-browser,ui-design-system}.css'],
    rules: {
      'declaration-property-value-disallowed-list': [{
        'font-size': ['/\\d*\\.?\\d+px/'],
        font: ['/\\d*\\.?\\d+px/'],
      }, {
        severity: 'warning',
        message: 'Review raw font size against secondary-ui-tokens.css; card art, icon glyphs and display numbers may intentionally differ.',
      }],
    },
  }],
};
