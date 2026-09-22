# Supplementary Protocol S1. Specimen photography, identifier review and publication in Wings Gallery

## Scope and versions

This protocol describes the photography-to-gallery workflow used for the Ithomiini project. It separates specimen preparation and photography, AI-assisted reading of identifiers, human review, file renaming, storage and indexing. It does not validate a taxonomic identification or the accuracy of a classifier. Dorsal and ventral files are linked by the specimen identifier, called CAMID in this project.

The software instructions refer to the [AI Photo Processor source at `49fe6ed`](https://github.com/Fr4nzz/rename_photos_AI/tree/49fe6ed226ed4914ed793e4252b74e18cf6ad8a4) and [Wings Gallery at `f5cb03f`](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery/tree/f5cb03f17f3ba639090b32fbedde6d6645ff847b), inspected on 22 September 2026. Live services can change independently. The software steps use the documented browser processor and Gallery indexing workflow.

Steps identified as **project practice** describe the available project protocol or the author's recorded setup. **Recommended checks** are safeguards for adapting the workflow. Values identified as **configurable** should be set for the adopting collection rather than copied as universal requirements.

## 1. Prepare the camera and work surface

**Project practice.** The recorded setup uses a Canon EOS 550D with a Canon EF-S 18–55 mm f/4–5.6 IS STM lens, approximately 28 cm above the table. The camera is held on an articulated support above a flat photography surface. A ruler and pencilled cross provide a repeatable arrangement. The colour reference is placed to the right and the specimen envelope or identifier label to the left.

Level the camera so that the sensor plane is parallel to the specimen surface. The original protocol uses a phone level and the camera grid for this check. Arrange the specimen area so that the complete wings, label and colour reference fit within the image. Establish focus on the wing surface and check it at magnification. The original workflow uses manual focus and a remote release or delayed shutter to reduce camera movement.

**Configurable.** Camera height, focal length, aperture, shutter speed, ISO and lighting depend on the equipment and specimen size. The camera model and height above are an example setup, not requirements. Choose exposure and lighting that retain the wing-pattern detail and keep the identifier legible. Keep framing and illumination consistent within a batch. Record any change in the session log.

**Recommended checks.** Photograph a test specimen before starting a batch. Inspect the full-resolution image for focus, clipped pale areas, deep shadows, reflections and readable labels. A colour reference documents a reference target within the scene. Its inclusion alone does not demonstrate that photographs have been colour-calibrated.

## 2. Photograph the dorsal and ventral views

**Project practice.** Work with one specimen at a time. Place its envelope or CAMID label beside its wings and keep them together throughout handling. In the detached-wing setup, arrange one wing in each quadrant around the positioning cross. Include all relevant wing material, the identifier and the colour reference without overlap that obscures them.

Photograph the dorsal surfaces first. Turn the wings over for the ventral photograph and exchange left and right positions as required by the physical arrangement. Preserve the identity of the specimen while turning the wings. Photograph the ventral surfaces with the same CAMID visible. Do not infer the surface solely from the order of photographs or from the presence of a sex-associated structure.

**Recommended checks.** Verify both surfaces before moving to the next specimen. Recheck focus, lighting and framing throughout the session. Record a missing wing, an unavailable surface or a replacement photograph in the batch notes. A duplicated image is not a second observed surface. Do not label a single-view record as a verified dorsal/ventral pair.

## 3. Organise and preserve a batch

**Project practice.** Copy photographs from the camera into dated batch folders. Retain the association between camera-generated filenames and the physical specimens until renaming is complete. The original workflow separates JPEG photographs used for the Gallery from RAW originals stored for retention.

**Recommended organisation.** Keep an untouched original copy and process a working copy. One suitable structure is shown below. These folder names are examples rather than required application names.

```text
2026-09-22_batch01/
  originals/
  working/
  reviewed_jpeg/
  retained_raw/
  review_log/
```

Count files before and after each transfer. Store the session date, photographer, camera and lens, orientation convention, exposure information where available, and any departures from the usual setup in the session log. Photograph capture dates and file modification dates are different fields. Do not use a changed modification date as proof of when the specimen was photographed.

## 4. Select and orient photographs in the AI Photo Processor

Open the [AI Photo Processor](https://fr4nzz.github.io/rename_photos_AI/). In **API Keys**, supply an API key authorised for the project. The documented application stores keys locally in the browser. Keep keys out of image folders, review CSV files, screenshots and public repositories. Confirm that the project permits transmission of the selected image content to the external interpretation service.

Use **Select & Rotate Images** to open the working folder. Select only files intended for the batch and check the active selection. Inspect their orientation before rotating. Apply a rotation only when needed, then verify the resulting image. Rotation direction and angle depend on the original orientation.

JPEG and PNG previews and rotations are supported in the documented browser workflow. RAW files can participate in companion-file renaming when their basenames match. Direct RAW rotation requires the optional Windows backend documented in the processor repository. A RAW file that cannot be previewed or rotated by the browser is not evidence of a failed JPEG operation. Avoid repeated rotations based only on an orientation flag and preserve originals before changing RAW metadata.

## 5. Configure identifier reading

In **Process Images**, position the crop over the identifier label and inspect several examples, including labels near the edges of the frame. A crop that excludes a character cannot be repaired reliably by a language model. Configure the model, prompt, grid rows and columns, merged image size and parallel messages for the batch.

**Project practice.** Cropped labels are assembled into grids and sent to the Gemini API for interpretation. The field containing the specimen identifier is the main naming field, called `CAM` in the documented processor defaults. Adapt the prompt to the label format used by the collection.

**Recommended checks.** Test a small batch containing clear, faint, crossed-out and ambiguous labels before processing the full folder. Confirm that returned fields correspond to the correct images. Do not treat API rate limits or older model names as fixed protocol parameters. Failed or interrupted requests require a review of which images received usable results before retrying.

## 6. Review identifiers and confirm pairs

Open **Review Results** and compare each interpreted identifier with the photograph and, when necessary, the physical label or source register. Correct a reading only when the evidence supports the correction. Leave unresolved records aside rather than creating an identifier to complete a pair.

Review flagged duplicates, missing surface pairs, missing readings and crossed-out labels. Confirm that each dorsal and ventral file belongs to the same physical specimen. Two files sharing an interpreted identifier are not sufficient evidence of a pair. Check specimen damage and wing-pattern details when labels are ambiguous.

Exclude accidental duplicates and unusable photographs from the rename selection. Record why a file was excluded and whether replacement photography is needed. Export the reviewed CSV or review table and retain it with the batch log. This human review establishes the approved filename mapping. It does not establish the specimen's taxonomic identity.

## 7. Rename files and validate the result

The project convention appends a side suffix to the approved CAMID: `d` for dorsal and `v` for ventral. For example, `CAM000123d.JPG` and `CAM000123v.JPG` illustrate a valid naming pattern. This is a fictitious example identifier. Confirm the configured prefix, suffix and extension handling before applying it to another collection.

Recalculate proposed filenames after review. Inspect the old-to-new mapping and resolve collisions before renaming. Preserve the processor's rename and undo logs. Where JPEG and RAW companions share the original basename, verify that the selected companion-file option preserves their association. Do not assume a RAW file has been renamed merely because its JPEG companion has changed.

After renaming, reconcile the file count with the approved mapping. Open a sample of the renamed files, including corrections and formerly ambiguous cases. Check that the filename agrees with the visible identifier and surface. Verify that each expected pair has exactly the intended two views and that excluded files have not entered the publication folder. Retain the original filenames in the log so that mistakes remain traceable.

## 8. Upload reviewed files to shared storage

**Project practice.** Reviewed JPEGs are uploaded to the project's shared Google Drive photo folders. RAW originals are retained separately. The Gallery index uses the configured photo folders, not an arbitrary upload directory.

**Configurable.** Each adopting group must choose its own storage account, folder hierarchy, access permissions and retention policy. Do not copy private project folder identifiers or assume that every specimen photograph can be shared publicly. Set permissions for the intended viewers and retain any attribution and reuse restrictions attached to the images.

Check the uploaded file count, filenames and accessible image links before updating the index. Avoid changing files in a folder while its index is being rebuilt. Keep old-to-new mappings when replacing a photograph, and verify that a replaced or deleted file does not leave a stale public link.

## 9. Index storage through Google Apps Script and Google Sheets

The Gallery repository supplies [`list_google_drive_files.gs`](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery/blob/f5cb03f17f3ba639090b32fbedde6d6645ff847b/list_google_drive_files.gs). For a new installation, create the indexing spreadsheet, open **Extensions → Apps Script**, and add the supplied script. Follow the pinned repository README to add the required LongRun library and enable the Drive API service. Configure `FOLDER_MAPPING` with the adopting group's folder identifiers.

Refresh the spreadsheet and use its **Photo Database Tools** menu to run the intended synchronisation. The script indexes photo information into `Photo_links` and supports batch processing and dead-link cleaning. Allow a suspended or continuing run to finish before starting another complete synchronisation. Use **Append New Files Only** for routine additions and **Full Sync (Clean + Add New)** when a complete reconciliation is intended. Use **Check Status** to follow a running job. The exact folder selection is project configuration, not a universal numbered menu choice. Folders whose names end in `_temp` are skipped. Keep reviewed publication images in an indexed folder. The indexer checks duplicate filenames across folders, so CAMID and surface filenames should remain unique.

Inspect the completed index. Check that the intended folders were traversed, newly uploaded files appear, names retain CAMID and surface suffixes, and representative URLs open with the intended access permissions. Review dead-link removal rather than assuming every failed request identifies a deleted photograph. Preserve an index snapshot before a large replacement or cleanup.

## 10. Update and validate the Gallery database

The Gallery's [documented processing script](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery/blob/f5cb03f17f3ba639090b32fbedde6d6645ff847b/scripts/process_data.py) reads the configured spreadsheets and writes the static display data. An authorised maintainer can use the Gallery's **Update DB** control. The documented route passes through a password-checking Cloudflare Worker to the `update_data.yml` GitHub Actions workflow. For a new installation, configure that update route and its credentials according to the repository deployment instructions. Never embed the update token in the public frontend or protocol.

An authorised maintainer can instead run the documented data-processing script in the configured repository environment. A local data build is not automatically a deployed Gallery update. Check the resulting data changes and complete the repository's build and deployment workflow.

After deployment, open [Wings Gallery](https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/) and search for representative newly added CAMIDs. Check image loading, dorsal/ventral association, specimen metadata and filters. Include at least one corrected identifier, one replacement photograph and one missing-view case in this validation where those cases occur in the batch. Confirm that an image shown is the intended specimen, not merely a file with a similar name.

## 11. Batch acceptance record

Retain the original image set, approved filename mapping, excluded-file reasons, rename logs, uploaded-file count, indexing completion record, generated-data commit and deployment identifier. Record who reviewed and accepted the batch. These recommended records allow another researcher to trace a Gallery image back to its photography and renaming history.

A batch is ready for release only when identifiers and surface labels have been reviewed, expected files are present, access permissions are appropriate, indexing has finished, and the deployed Gallery displays the intended records. Unresolved identities or missing views remain explicit exceptions. Uploading images, producing a taxonomic prediction and independently validating a specimen are separate operations.
