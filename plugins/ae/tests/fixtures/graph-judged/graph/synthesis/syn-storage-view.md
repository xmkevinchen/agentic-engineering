---
id: syn-storage-view
title: "Storage view"
created: 2026-01-01
written_by: batch
state: fresh
anchors:
  - source: "src/cache.txt:2"
    anchor_hash: "The storage layer batches flushes on a five second timer."
---

The storage layer is write-back: writes are buffered and flushed on a five
second timer, never synchronously (src/cache.txt:2). The cache-model
component sits in front of it.
