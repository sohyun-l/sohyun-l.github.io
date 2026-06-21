---
layout: page
permalink: /gallery/
title: Gallery
description: Last updated June 21, 2026
nav: true
---

<!-- pages/gallery.md -->
<div class="gallery-grid">
  {%- for item in site.data.gallery -%}
  <figure class="gallery-item">
    <a href="{{ '/assets/img/gallery/' | append: item.image | relative_url }}"
       class="gallery-link"
       data-caption="{{ item.caption }}">
      <img src="{{ '/assets/img/gallery/' | append: item.image | relative_url }}"
           alt="{{ item.caption }}" loading="lazy">
    </a>
    {%- if item.caption and item.caption != "" -%}
    <figcaption>{{ item.caption }}</figcaption>
    {%- endif -%}
  </figure>
  {%- endfor -%}
</div>

<!-- Lightbox overlay -->
<div id="gallery-lightbox" class="gallery-lightbox" role="dialog" aria-hidden="true">
  <span class="gallery-lightbox-close" aria-label="Close">&times;</span>
  <img class="gallery-lightbox-img" src="" alt="">
  <div class="gallery-lightbox-caption"></div>
</div>

<script>
  (function () {
    var lightbox = document.getElementById('gallery-lightbox');
    var lightboxImg = lightbox.querySelector('.gallery-lightbox-img');
    var lightboxCaption = lightbox.querySelector('.gallery-lightbox-caption');
    var closeBtn = lightbox.querySelector('.gallery-lightbox-close');

    document.querySelectorAll('.gallery-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        lightboxImg.src = link.getAttribute('href');
        lightboxCaption.textContent = link.getAttribute('data-caption') || '';
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
      });
    });

    function closeLightbox() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
    }

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  })();
</script>
