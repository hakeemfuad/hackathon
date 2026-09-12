let catalogPromise;
export function loadCatalog(){
  if(!catalogPromise)catalogPromise=fetch('./data/products.json').then(response=>{
    if(!response.ok)throw new Error('The sample catalog could not load. Reload to try again.');
    return response.json();
  }).catch(error=>{catalogPromise=null;throw error;});
  return catalogPromise;
}
