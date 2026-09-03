---
layout: about
title: About
permalink: /
subtitle:

profile:
  align: right
  image: SohyunLee.png
  image_cicular: true # crops the image to make it circular
  address:

news: true  # includes a list of news items
experience: true # includes a list of experience items
education: true # includes a list of education items
selected_papers: true # includes a list of papers marked as "selected={true}"
services: true
honors: true
social: true  # includes social icons at the bottom of the page
---
I am a postdoctoral researcher in the [Computer Vision Lab](https://cvlab.postech.ac.kr) at [POSTECH CSE](https://cse.postech.ac.kr/csepostech/index.do), working with Prof. [Suha Kwak](https://suhakwak.github.io), who also advised my Ph.D. in Artificial Intelligence at POSTECH GSAI. Earlier this year, I was a visiting researcher at the Mohamed bin Zayed University of Artificial Intelligence (MBZUAI), working with Prof. [Ivan Laptev](https://scholar.google.com/citations?user=-9ifK0cAAAAJ&hl=en). During my Ph.D., I visited or closely collaborated with Prof. [Konrad Schindler](https://prs.igp.ethz.ch/group/people/person-detail.schindler.html) and Dr. [Christos Sakaridis](https://people.ee.ethz.ch/~csakarid/) at ETH Zürich, Dr. [Lukas Hoyer](https://lhoyer.github.io/) at Google Zürich, and Prof. [Seong Joon Oh](https://seongjoonoh.com/) at the Tübingen AI Center, University of Tübingen.\
\
I build **physical AI for the real world**. Across *seeing*, *understanding*, and *acting*, I work on robust sensing and perception ([FIFO](https://arxiv.org/abs/2204.01587), [ExLPose](https://arxiv.org/abs/2303.15410), [FREST](https://arxiv.org/abs/2407.13437)), robust finetuning of foundation models ([GaRA-SAM](https://arxiv.org/abs/2506.02882), [RobustPVOS](https://arxiv.org/abs/2605.12006)), test-time adaptation ([TestDG](https://arxiv.org/abs/2504.04981)), and robust embodied AI (Self-Compensating VLA). My current focus is on **reliable vision-language-action models for real-world deployment**.

<section class="research-direction" markdown="0">
  <h2>Research Direction</h2>
  <p class="rd-tagline"><em>Robust Physical AI for Real-World Applications.</em></p>
  <div class="rd-flow">
    <svg class="rd-arrows" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id="rd-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
        </marker>
      </defs>
      <!-- See (upper-left) curves down to Understand (lower-center) -->
      <path d="M 55 40 Q 60 75 78 68" fill="none" stroke="currentColor" stroke-width="0.6"
            stroke-linecap="round" marker-end="url(#rd-arrowhead)"/>
      <!-- Understand (lower-center) curves up to Act (upper-right) -->
      <path d="M 122 68 Q 140 75 145 40" fill="none" stroke="currentColor" stroke-width="0.6"
            stroke-linecap="round" marker-end="url(#rd-arrowhead)"/>
    </svg>
    <div class="rd-grid">
      <details class="rd-card rd-see">
        <summary>
          <img src="{{ '/assets/img/rd_see.png' | relative_url }}" alt="Camera" class="rd-icon">
          <div class="rd-label">See</div>
          <div class="rd-sub">Sensing</div>
        </summary>
        <ul class="rd-papers">
          <li><a href="https://arxiv.org/abs/2303.15410">Human Pose Estimation in Extremely Low-Light Conditions</a> <span class="rd-venue">CVPR 2023</span></li>
        </ul>
      </details>

      <details class="rd-card rd-understand">
        <summary>
          <img src="{{ '/assets/img/rd_understand.png' | relative_url }}" alt="Perception" class="rd-icon">
          <div class="rd-label">Understand</div>
          <div class="rd-sub">Perception</div>
        </summary>
        <ul class="rd-papers">
          <li><a href="https://arxiv.org/abs/2204.01587">FIFO: Learning Fog-invariant Features for Foggy Scene Segmentation</a> <span class="rd-venue">CVPR 2022</span></li>
          <li><a href="https://arxiv.org/abs/2407.13437">FREST: Feature RESToration for Semantic Segmentation under Multiple Adverse Conditions</a> <span class="rd-venue">ECCV 2024</span></li>
          <li><a href="https://arxiv.org/abs/2506.02882">GaRA-SAM: Robustifying Segment Anything Model with Gated-Rank Adaptation</a> <span class="rd-venue">NeurIPS 2025</span></li>
          <li><a href="https://arxiv.org/abs/2605.12006">Robust Promptable Video Object Segmentation</a> <span class="rd-venue">CVPR 2026</span></li>
          <li><a href="https://arxiv.org/abs/2504.04981">TestDG: Test-time Domain Generalization for Continual Test-time Adaptation</a> <span class="rd-venue">Under Review</span></li>
        </ul>
      </details>

      <details class="rd-card rd-act">
        <summary>
          <img src="{{ '/assets/img/rd_act.png' | relative_url }}" alt="Embodied AI" class="rd-icon">
          <div class="rd-label">Act</div>
          <div class="rd-sub">Embodied AI</div>
        </summary>
        <ul class="rd-papers">
          <li><span class="rd-title">Robustness to Robot Hardware Imperfections: A Benchmark and a Self-Compensating VLA</span> <span class="rd-venue">Under Review</span></li>
        </ul>
      </details>
    </div>
  </div>
</section>
