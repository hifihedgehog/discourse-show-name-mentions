import { bind } from "discourse-common/utils/decorators";
import { ajax } from "discourse/lib/ajax";
import { apiInitializer } from "discourse/lib/api";

// names are cached because of the composer.
// without this, the ajax calls would be made everytime the user updated the text
const cachedNames = {};

function updateMention(aMention, username, name) {
  if (name) {
    aMention.dataset.username = username;
    aMention.innerText = `${name}`;
    aMention.classList.add("mention-fullname");
  }
}

export default apiInitializer("0.8", (api) => {
  if (!settings.show_fullname_in_mentions) return;

  api.decorateCookedElement(
    (element) => {
      const mentions = element.querySelectorAll("a.mention,a.mention-group");

      mentions.forEach((aMention) => {
        if (aMention.dataset.username) {
          // the element is already changed
          return;
        }

        const username = aMention.innerText;

        if (aMention.hasAttribute("data-full-name")) {
          updateMention(aMention, username, aMention.dataset.fullName);
          return;
        }

        const cachedName = cachedNames[username];
        if (cachedName) {
          updateMention(aMention, username, cachedName);
          return;
        }

        const userHref = aMention.attributes.href.value;
        // console.log({username, cached: cachedNames[username]})

        // fetch the user data to get the name
        ajax(userHref).then(
          (data) => {
            const name = data.user.name;
            cachedNames[username] = name;

            updateMention(aMention, username, name);
          },
          () => {
            // in case of error in the request we will just use the username for this user
            cachedNames[username] = null;
          }
        );
      });
    },
    {
      id: "show-named-mentions",
    }
  );

  api.modifyClass("component:user-card-contents", {
    pluginId: "show-named-mentions",

    @bind
    _cardClickHandler(event) {
      // I'd like to test for the data attribute to to call this._showCardOnClick with
      // the correct username or else call this._super but could not find a way to make
      // it work because this method is inherited from a mixin, so I adapted the method from
      // https://github.com/discourse/discourse/blob/main/app/assets/javascripts/discourse/app/mixins/card-contents-base.js#L132

      if (this.avatarSelector) {
        let matched = this._showCardOnClick(
          event,
          this.avatarSelector,
          (el) => el.dataset[this.avatarDataAttrKey]
        );

        if (matched) {
          return; // Don't need to check for mention click; it's an avatar click
        }
      }

      // Mention click
      this._showCardOnClick(event, this.mentionSelector, (el) => {
        // return the username data attribute if present or else fallback to the
        // default innerText
        const username = el.dataset.username || el.innerText;
        return username.replace(/^@/, "");
      });
    },
  });
});
