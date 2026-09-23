# Manuscript figures

## Figure 1

`figure1_workflow.svg` is the primary editable artwork. Text and shapes remain vector. Its intended width is 180 mm and its height is 194.25 mm. `figure1_workflow.png` is a 4320 × 4662-pixel, 600-dpi preview. Colours are restrained and supplemented by text labels and different outlines, so data types do not depend on colour alone.

Rebuild with:

```sh
python paper/figures/make_figure1.py --png
```

SVG generation uses the Python standard library. PNG rendering also needs CairoSVG and Pillow. No font files are distributed. The scientific source is the manuscript at Phase 3A commit `0cbf510b5de3afd99cd39729a297671afcfbd241`, not a new audit or experiment. Figure 1 contains no specimen photographs, reconstructed interfaces or performance estimates. Its six panels keep human review, upload inference, paired collection classification, Atlas data types and separate releases explicit.

## Figure 2

No Figure 2 asset is supplied. Its caption remains in the manuscript, without an internal drafting instruction or broken image reference. The exact remaining work is in [figure2_capture_spec.md](figure2_capture_spec.md). Actual application captures and image-rights confirmation are required.

`figure_provenance.json` records both figure states. Rendering and geometry checks concern layout only, not biological or model validation.
