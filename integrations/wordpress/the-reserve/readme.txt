=== The Reserve Watch Widgets ===
Contributors: thereserve
Tags: watches, quiz, product finder, recommendations, widget
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add The Reserve's watch finder, archetype quiz, film watch search, cheaper alternatives and watch stories to your site.

== Description ==

The Reserve helps visitors find the right watch. With this plugin you can place its tools on any page:

* **Watch diagnostic** (quiz): six questions, then a shortlist of watches confirmed on their makers' pages.
* **Watch archetype** (archetype): a four-question watch personality quiz with ten watches.
* **Watches from the screen** (find): the watches seen in a film, series, or on a person.
* **Cheaper alternatives** (alternatives): watches that look and work like a named one, for less.
* **Watch stories** (stories): reviewed watches from cinema and public life.

Visitors never need an account or an email address. The widgets set no cookies.

You need a partner key from The Reserve: https://thereserve.watch/partners

== Installation ==

1. Upload the plugin (Plugins → Add New → Upload Plugin) and activate it.
2. Settings → The Reserve: paste your public key (pk_live_…) and choose your colours.
3. Add `[the_reserve feature="quiz"]` to a page, or insert the "The Reserve" block.

Shortcode options: `feature` (quiz, archetype, find, alternatives, stories), `scheme` (light, dark), `accent`, `bg`, `surface`, `text` (hex colours), `font` (system, serif), `radius` (0–32), `params` (e.g. `type=actor&q=Daniel Craig`).

== External services ==

The widgets are served by The Reserve (https://thereserve.watch). The plugin loads https://thereserve.watch/embed.js on pages that show a widget, and the widget runs in a frame from thereserve.watch. Only what a visitor types into the widget (their search answers) is sent; no personal data. Privacy policy: https://thereserve.watch/privacy

== Changelog ==

= 1.0.0 =
* First release: shortcode, block, settings page.
