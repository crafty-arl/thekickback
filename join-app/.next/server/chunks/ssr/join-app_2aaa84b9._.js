module.exports=[90563,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(30139)},50914,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},56677,a=>{"use strict";var b=a.i(90563),c=a.i(13623);async function d(){let a=(0,c.createClient)(process.env.SUPABASE_URL||"https://wofvgfhejrvudvfxdytc.supabase.co",process.env.SUPABASE_SERVICE_KEY),{data:b,error:d}=await a.from("venue_pages").select(`
      slug,
      tagline,
      description,
      theme_color,
      hours,
      venues (
        id,
        name,
        type,
        address,
        neighborhood,
        latitude,
        longitude,
        lat,
        lng,
        occupancy,
        max_occupancy,
        vibe,
        phone,
        twilio_number
      )
    `).eq("published",!0).eq("review_status","approved");return d?(console.error("[fetchApprovedVenues] Supabase error:",d.message),[]):b&&0!==b.length?b.filter(a=>{let b=a.venues;return!!b&&("number"==typeof b.latitude&&"number"==typeof b.longitude||"number"==typeof b.lat&&"number"==typeof b.lng)}).map(a=>{let b=a.venues,c=a.hours,d=c&&c.length>0?c.map(a=>`${a.day} ${a.open}${a.close?` – ${a.close}`:""}`).join(", "):"Hours vary";return{id:b.id,name:b.name,slug:a.slug,category:b.type||"venue",neighborhood:b.neighborhood||"",vibe:b.vibe||"quiet",occupancy:b.occupancy||0,capacity:b.max_occupancy||100,description:a.description||a.tagline||"",tags:[],hours:d,memberOnly:!1,textNumber:b.twilio_number||b.phone||"",latitude:b.latitude||b.lat,longitude:b.longitude||b.lng,themeColor:a.theme_color||"#F97316"}}):[]}(0,a.i(50914).ensureServerEntryExports)([d]),(0,b.registerServerReference)(d,"00d16b21ed4b62efc7c9e7d5ff8a218bb5ad83c6a9",null),a.s(["fetchApprovedVenues",()=>d])},84565,a=>{"use strict";var b=a.i(56677);a.s([],80424),a.i(80424),a.s(["00d16b21ed4b62efc7c9e7d5ff8a218bb5ad83c6a9",()=>b.fetchApprovedVenues],84565)}];

//# sourceMappingURL=join-app_2aaa84b9._.js.map