# Meta App Review — Test Instructions

This guide walks you through testing the Garden Prayer Campaign Engine's Facebook and Instagram integration. Follow each step in order. No prior knowledge of the product is required.

---

## Prerequisites

- A Facebook Page you administer (any test Page works)
- An Instagram Business account linked to that Facebook Page (optional, for Instagram testing)
- Access to the [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)

---

## Step 1: Log In to the Test Account

1. Open the app: `https://campaigns.gardenprayerpublishing.com`
2. You will see a login screen.
3. Enter the test credentials:
   - **Email**: `admin@campaignengine.local`
   - **Password**: `admin123`
4. Click **Log In**.
5. **Expected result**: You are redirected to the Dashboard showing businesses.

---

## Step 2: Connect a Facebook Page Using Manual Override

Because the app is in Development mode, the standard OAuth flow may not enumerate your Pages. Use the Manual Connection form instead.

1. From the Dashboard, click on a business (e.g., **Melissa for Educators**).
2. On the business detail page, scroll down to the **Meta Integration** panel on the right sidebar.
3. If not already connected, you will see a "Connect via OAuth" button and a **Manual Connection (Development Mode)** toggle below it.
4. Click **Manual Connection (Development Mode)** to expand the form.
5. Fill in the fields:
   - **Page ID**: Your Facebook Page ID.
     - To find it: Go to your Facebook Page → Settings → Page Transparency → Page ID.
     - Or in Graph API Explorer: run `GET /me/accounts` and copy the `id` of the Page.
   - **Page Name**: The name of your Facebook Page (e.g., "My Test Page").
   - **Page Access Token**: A Page Access Token with `pages_manage_posts` permission.
     - To get one: Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select your app, click "Get Token" → "Get Page Access Token", grant permissions, then copy the token shown.
   - **Instagram Business Account ID** (optional): If your Page has a linked Instagram Business account.
     - To find it: In Graph API Explorer, run `GET /{your-page-id}?fields=instagram_business_account` and copy the `id` from the response.
6. Click **Save Manual Connection**.
7. **Expected result**: The Meta Integration panel updates to show "Connected" with a green dot, your Page name, Page ID, and Instagram Account ID (if provided).

---

## Step 3: Connect an Instagram Business Account

If you did not enter an Instagram Business Account ID in Step 2:

1. On the business detail page, click **Disconnect** in the Meta Integration panel.
2. Re-open the **Manual Connection** form.
3. This time, include the **Instagram Business Account ID** field.
   - Get it from Graph API Explorer: `GET /{page-id}?fields=instagram_business_account`
4. Click **Save Manual Connection**.
5. **Expected result**: The panel now shows both the Facebook Page and the Instagram Account ID.

If you used the OAuth flow instead:
- The system automatically detects the Instagram Business account linked to the selected Page.
- **Expected result**: Instagram Account ID appears in the Meta Integration panel after OAuth completes.

---

## Step 4: Publish a Post to Facebook and Verify

1. Navigate to **Campaigns** from the sidebar.
2. Select an existing campaign (or create one by clicking **New Campaign**, selecting a Playbook and audience, then saving).
3. Navigate to **Content** from the sidebar.
4. If no content exists, click **Generate Content**, select your campaign, and click Generate. Wait for content to appear.
5. Find a content item with status **generated**. Click on it to view details.
6. Click **Approve** to change its status to **approved**.
7. Click **Schedule Post**. Select **Facebook** as the platform and choose a time in the near future (or "Post Now" if available).
8. The post will be picked up by the posting cron (runs every 5 minutes).
9. **Expected result**: After a few minutes, the post status changes from "scheduled" → "posting" → "posted". The `platformPostId` is populated. You can verify the post appeared on your Facebook Page by visiting it.

---

## Step 5: Publish a Post to Instagram and Verify

1. Ensure an Instagram Business Account ID is connected (see Step 3).
2. The content item **must have an image attached**. Instagram requires an image for every post.
   - If no image is attached: go to **Images** in the sidebar, upload an image for the business, then associate it with the content.
3. Approve a content item (if not already approved).
4. Click **Schedule Post**. Select **Instagram** as the platform.
5. The posting cron will:
   - Create a media container on Instagram with the image URL and caption.
   - Poll the container status until it is `FINISHED` (up to 10 polls, 3 seconds apart).
   - Publish the container to Instagram.
6. **Expected result**: After a few minutes, the post status changes to "posted". You can verify the post appeared on your Instagram Business account.

**Instagram-specific error scenarios**:
- If the image aspect ratio is outside 4:5 to 1.91:1, the post will fail with a descriptive error.
- If the image URL is not publicly accessible, the post will fail with a descriptive error.
- If you exceed 25 posts in 24 hours, the post will fail with a rate limit error.

All errors are displayed in the post detail view with the specific reason.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth flow says "No Facebook Pages found" | Use the Manual Connection form (Step 2). This is expected in Development mode. |
| Post stays in "scheduled" status | The posting cron runs every 5 minutes. Wait at least 5 minutes. Check the Escalations page for error details. |
| Instagram post fails with "image required" | Attach an image to the content before scheduling for Instagram. |
| Token expired error | Generate a new Page Access Token from Graph API Explorer and use Manual Connection to update it. |
| Post appears on Facebook but not in the app | The metrics polling cron runs every 30 minutes. The post status should already show "posted" immediately after the cron processes it. |
